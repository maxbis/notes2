// Save logic with conflict handling and auto-save
import state, { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { getEditorHtml } from './editor.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './indicators.js';
import { hasMeaningfulNoteContent } from './utils.js';
import { getCurrentTags, renderSidebarTagFilters, setCurrentTags, setSavedTags } from './tags.js';

// Dependencies that will be injected
let showConflictDialog = null;
let refreshCurrentNote = null;
let renderNotesList = null;

function updatePinButtonsForSavedNote(note = null) {
    const isPinned = Number(note?.is_pinned) === 1;
    const label = isPinned ? 'Unpin' : 'Pin';
    ['pinNoteBtn', 'pinNoteBtnMobile'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !note;
        btn.textContent = label;
        btn.setAttribute('aria-label', note ? `${label} this note` : 'No note selected');
        btn.setAttribute('title', note ? `${label} this note` : 'No note selected');
    });
}

export function initSave(deps) {
    showConflictDialog = deps.showConflictDialog;
    refreshCurrentNote = deps.refreshCurrentNote;
    renderNotesList = deps.renderNotesList;
}

/**
 * Queues a save operation to prevent overlapping saves that could cause self-conflicts.
 * 
 * The save queue ensures only one save runs at a time. If a save is already in progress,
 * this request is queued and will run immediately after the current save completes.
 * Multiple queued saves are coalesced (only the latest parameters are used).
 * 
 * @param {boolean} showFeedback - Whether to show user feedback after save
 * @param {boolean} forceOverwrite - Whether to force overwrite on version conflicts
 * @returns {Promise} Resolves when the save queue becomes idle
 */
export async function saveNote(showFeedback = true, forceOverwrite = false) {
    // Mark that a save is pending and merge parameters
    state.saveQueue.pending = true;
    state.saveQueue.pendingShowFeedback = state.saveQueue.pendingShowFeedback || !!showFeedback;
    state.saveQueue.pendingForceOverwrite = state.saveQueue.pendingForceOverwrite || !!forceOverwrite;

    return new Promise((resolve, reject) => {
        // Add this caller to the list of waiters
        state.saveQueue.idleWaiters.push({ resolve, reject });

        // If a queue processor is already running, just queue this request
        if (state.saveQueue.runnerPromise) return;

        // Start the queue processor
        state.saveQueue.runnerPromise = (async () => {
            try {
                let lastResult = true;
                // Process all queued saves sequentially
                while (state.saveQueue.pending) {
                    // Capture the parameters for this save
                    const nextShowFeedback = state.saveQueue.pendingShowFeedback;
                    const nextForceOverwrite = state.saveQueue.pendingForceOverwrite;

                    // Clear the pending flags
                    state.saveQueue.pending = false;
                    state.saveQueue.pendingShowFeedback = false;
                    state.saveQueue.pendingForceOverwrite = false;

                    // Perform the actual save
                    lastResult = await performSave(nextShowFeedback, nextForceOverwrite);
                }

                // All saves complete - resolve all waiting promises
                const waiters = state.saveQueue.idleWaiters;
                state.saveQueue.idleWaiters = [];
                waiters.forEach(w => w.resolve(lastResult));
            } catch (err) {
                // On error, reject all waiting promises
                const waiters = state.saveQueue.idleWaiters;
                state.saveQueue.idleWaiters = [];
                waiters.forEach(w => w.reject(err));
            } finally {
                // Clear the runner promise so a new one can start if needed
                state.saveQueue.runnerPromise = null;
            }
        })();
    });
}

async function performSave(showFeedback = true, forceOverwrite = false) {
    const rawTitle = document.getElementById('noteTitle').value.trim();
    const title = rawTitle || 'Untitled';
    const content = getEditorHtml();
    const tags = getCurrentTags();
    const previousTitle = state.currentNote?.title || state.savedTitle || '';

    const timestamp = new Date().toISOString();
    const saveType = state.currentNote ? 'UPDATE' : 'CREATE';
    console.log(`[SAVE ${saveType}] ${timestamp} - Starting save operation`, {
        noteId: state.currentNote?.hash_id || 'NEW',
        title: title.substring(0, 50),
        contentLength: content.length,
        showFeedback,
        forceOverwrite,
        originalVersion: state.originalVersion
    });

    try {
        let response;
        if (state.currentNote) {
            let attemptForceOverwrite = !!forceOverwrite;

            while (true) {
                // Update existing note
                const updateData = {
                    hash_id: state.currentNote.hash_id,
                    title: title,
                    content: content,
                    tags: tags,
                    is_pinned: Number(state.currentNote?.is_pinned) === 1 ? 1 : 0,
                    expected_version: state.originalVersion,
                    force_overwrite: !!attemptForceOverwrite
                };
                console.log(`[SAVE UPDATE] Sending PUT request`, {
                    hash_id: state.currentNote.hash_id,
                    titleLength: title.length,
                    contentLength: content.length
                });
                response = await fetch(API_ENDPOINT, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData)
                });

                // Server-enforced optimistic lock: 409 means someone saved since our last known version.
                // With queued saves, this should not happen due to our own overlapping requests anymore.
                if (response.status === 409 && !attemptForceOverwrite) {
                    const conflict = await readJsonResponse(response, 'saveNote:conflict409');
                    const serverUpdatedAt = conflict?.updated_at ? new Date(conflict.updated_at) : new Date();
                    console.warn(`[SAVE CONFLICT DETECTED]`, {
                        expectedVersion: state.originalVersion,
                        serverVersion: conflict?.server_version,
                        behindBy: conflict?.behind_by
                    });

                    const conflictResolved = await showConflictDialog(
                        serverUpdatedAt,
                        conflict?.title,
                        conflict?.content,
                        conflict?.behind_by
                    );

                    if (!conflictResolved) {
                        console.log(`[SAVE CANCELLED] User chose to cancel and refresh due to conflict`);
                        await refreshCurrentNote();
                        return false;
                    }

                    console.log(`[SAVE OVERWRITE] User chose to overwrite conflicting version`);
                    attemptForceOverwrite = true;
                    continue;
                }

                break;
            }
        } else {
            if (!hasMeaningfulNoteContent(rawTitle, content, tags)) {
                console.log('[SAVE CREATE] Skipping create for empty placeholder note');
                state.hasUnsavedChanges = false;
                clearTimeout(state.autoSaveTimer);
                updateUnsavedIndicator();
                return false;
            }
            // Create new note
            const createData = {
                title: title,
                content: content,
                tags: tags,
                is_pinned: 0
            };
            console.log(`[SAVE CREATE] Sending POST request`, {
                titleLength: title.length,
                contentLength: content.length
            });
            response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(createData)
            });
        }

        const savedNote = await readJsonResponse(response, `saveNote:${saveType}`);

        if (savedNote.error) {
            console.error(`[SAVE ERROR] Failed to save note:`, savedNote.error, {
                noteId: state.currentNote?.hash_id,
                responseStatus: response.status
            });
            alert('Error saving note: ' + savedNote.error);
            return false;
        }

        console.log(`[SAVE SUCCESS] Note saved successfully`, {
            noteId: savedNote.hash_id,
            savedTimestamp: savedNote.updated_at,
            title: savedNote.title?.substring(0, 50),
            saveType: saveType
        });

        // Update local notes array
        if (state.currentNote) {
            const index = state.notes.findIndex(n => n.hash_id === state.currentNote.hash_id);
            if (index !== -1) {
                state.notes[index] = savedNote;
            }
            state.currentNote = savedNote;
        } else {
            state.notes.unshift(savedNote);
            state.currentNote = savedNote;
            state.originalVersion = savedNote.version != null ? Number(savedNote.version) : null; // Set version for new notes
        }

        // Re-sort with pinned notes first.
        state.notes.sort((a, b) => {
            const pinnedDiff = (Number(b?.is_pinned) === 1 ? 1 : 0) - (Number(a?.is_pinned) === 1 ? 1 : 0);
            if (pinnedDiff !== 0) return pinnedDiff;
            return new Date(b.updated_at) - new Date(a.updated_at);
        });
        updatePinButtonsForSavedNote(state.currentNote);
        renderSidebarTagFilters();

        // Update saved state
        state.savedTitle = savedNote.title || '';
        state.savedContent = savedNote.content || '';
        setSavedTags(savedNote.tags || []);
        setCurrentTags(savedNote.tags || []);
        state.hasUnsavedChanges = false;
        clearTimeout(state.autoSaveTimer);

        // Update unsaved indicator
        updateUnsavedIndicator();

        // Update original version after successful save
        state.originalVersion = savedNote.version != null ? Number(savedNote.version) : null;

        // Update last saved timestamp
        const savedAt = new Date(savedNote.updated_at);
        updateLastSavedTime(savedAt);

        console.log(`[SAVE COMPLETE] Save operation finished`, {
            noteId: savedNote.hash_id,
            timestamp: savedAt.toISOString(),
            hasUnsavedChanges: false
        });

        // Only re-render notes list if called from auto-save (not from selectNote)
        // When called from selectNote (showFeedback=false), selectNote will handle rendering
        if (!showFeedback) {
            // Auto-save: for CREATE we must render so the new note appears in the sidebar.
            // For UPDATE, re-render when the title changes (affects list/grouping).
            if (saveType === 'CREATE' || previousTitle !== savedNote.title) {
                renderNotesList(document.getElementById('searchInput').value);
            }
        } else {
            // This branch is no longer needed since we removed manual save button
            // But keeping it for safety in case showFeedback is true elsewhere
            renderNotesList(document.getElementById('searchInput').value);
        }

        return true;
    } catch (error) {
        console.error(`[SAVE EXCEPTION] Error occurred during save:`, error, {
            noteId: state.currentNote?.hash_id,
            saveType: saveType,
            timestamp: new Date().toISOString()
        });
        alert('Error saving note. Please try again.');
        return false;
    }
}

export function saveBeforeUnload() {
    // Prevent multiple simultaneous unload saves (can be triggered by visibilitychange, blur, and beforeunload)
    if (state.unloadSaveInProgress) {
        console.log(`[SAVE UNLOAD] Already saving, skipping duplicate call`);
        return;
    }
    
    // Save using fetch with keepalive for reliable sending during page unload
    // The keepalive flag ensures the request continues even after the page starts unloading
    const rawTitle = document.getElementById('noteTitle').value.trim();
    const title = rawTitle || 'Untitled';
    const content = getEditorHtml();
    const tags = getCurrentTags();
    
    if (state.hasUnsavedChanges && state.currentNote) {
        state.unloadSaveInProgress = true;
        
        console.log(`[SAVE UNLOAD] Saving before page unload`, {
            noteId: state.currentNote.hash_id,
            title: title.substring(0, 50),
            contentLength: content.length,
            timestamp: new Date().toISOString()
        });
        
        // Use fetch with keepalive flag - this is the standard way to send data during page unload.
        // It's supported in all modern browsers and is more reliable than regular fetch.
        // Do not force-overwrite conflicts here; a stale background tab should never create silent copies.
        fetch(API_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash_id: state.currentNote.hash_id,
                title: title,
                content: content,
                tags: tags,
                is_pinned: Number(state.currentNote?.is_pinned) === 1 ? 1 : 0,
                expected_version: state.originalVersion,
                force_overwrite: false
            }),
            keepalive: true  // Critical: allows request to complete even after page unloads
        }).then(response => {
            return readJsonResponse(response, 'saveBeforeUnload').then(data => {
                if (data.error) {
                    console.error(`[SAVE UNLOAD ERROR] Failed to save on unload:`, data.error);
                } else {
                    console.log(`[SAVE UNLOAD SUCCESS] Saved successfully on unload`, {
                        noteId: data.hash_id,
                        timestamp: data.updated_at
                    });
                    // Update state to reflect the successful save
                    // This is critical: if the page doesn't unload (e.g., just tab switch), 
                    // we need to update the version to avoid conflicts when user returns
                    state.originalVersion = data.version != null ? Number(data.version) : null;
                    state.savedTitle = data.title || '';
                    state.savedContent = data.content || '';
                    setSavedTags(data.tags || []);
                    setCurrentTags(data.tags || []);
                    state.hasUnsavedChanges = false;
                    // Update the note in the notes array
                    const index = state.notes.findIndex(n => n.hash_id === data.hash_id);
                    if (index !== -1) {
                        state.notes[index] = data;
                    }
                    // Update UI indicators
                    updateUnsavedIndicator();
                    const savedAt = new Date(data.updated_at);
                    updateLastSavedTime(savedAt);
                }
                // Reset flag after a delay to allow for potential retries if page doesn't unload
                setTimeout(() => {
                    state.unloadSaveInProgress = false;
                }, 2000);
            });
        }).catch(err => {
            // Silently fail - page is unloading anyway
            console.error(`[SAVE UNLOAD EXCEPTION] Error during unload save:`, err);
            // Reset flag after a delay
            setTimeout(() => {
                state.unloadSaveInProgress = false;
            }, 2000);
        });
    } else if (state.hasUnsavedChanges && !state.currentNote) {
        if (!hasMeaningfulNoteContent(rawTitle, content, tags)) {
            console.log('[SAVE UNLOAD] Skipping create for empty placeholder note');
            return;
        }
        state.unloadSaveInProgress = true;
        
        // New note that hasn't been created on the server yet — try to create it on unload.
        console.log(`[SAVE UNLOAD] Creating new note before page unload`, {
            title: title.substring(0, 50),
            contentLength: content.length,
            timestamp: new Date().toISOString()
        });

        fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title || 'Untitled',
                content: content,
                tags: tags,
                is_pinned: 0
            }),
            keepalive: true
        }).then(response => {
            return readJsonResponse(response, 'saveBeforeUnload:create').then(data => {
                if (data.error) {
                    console.error(`[SAVE UNLOAD ERROR] Failed to create on unload:`, data.error);
                } else {
                    console.log(`[SAVE UNLOAD SUCCESS] Created successfully on unload`, {
                        noteId: data.hash_id,
                        timestamp: data.updated_at
                    });
                    // Update state to reflect the successful creation
                    state.currentNote = data;
                    state.originalVersion = data.version != null ? Number(data.version) : null;
                    state.savedTitle = data.title || '';
                    state.savedContent = data.content || '';
                    setSavedTags(data.tags || []);
                    setCurrentTags(data.tags || []);
                    state.hasUnsavedChanges = false;
                    // Add to notes array
                    state.notes.unshift(data);
                    // Update UI indicators
                    updateUnsavedIndicator();
                    const savedAt = new Date(data.updated_at);
                    updateLastSavedTime(savedAt);
                }
                // Reset flag after a delay
                setTimeout(() => {
                    state.unloadSaveInProgress = false;
                }, 2000);
            });
        }).catch(err => {
            console.error(`[SAVE UNLOAD EXCEPTION] Error during unload create:`, err);
            // Reset flag after a delay
            setTimeout(() => {
                state.unloadSaveInProgress = false;
            }, 2000);
        });
    } else {
        console.log(`[SAVE UNLOAD] No save needed`, {
            hasNote: !!state.currentNote,
            hasUnsavedChanges: state.hasUnsavedChanges
        });
    }
}
