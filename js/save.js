// Save logic with conflict handling and auto-save
import state, { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { getEditorHtml } from './editor.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './indicators.js';

// Dependencies that will be injected
let showConflictDialog = null;
let refreshCurrentNote = null;
let renderNotesList = null;

export function initSave(deps) {
    showConflictDialog = deps.showConflictDialog;
    refreshCurrentNote = deps.refreshCurrentNote;
    renderNotesList = deps.renderNotesList;
}

export async function saveNote(showFeedback = true, forceOverwrite = false) {
    // Queue saves so we never have overlapping PUTs (which can cause self-conflicts).
    state.savePending = true;
    state.savePendingShowFeedback = state.savePendingShowFeedback || !!showFeedback;
    state.savePendingForceOverwrite = state.savePendingForceOverwrite || !!forceOverwrite;

    return new Promise((resolve, reject) => {
        state.saveIdleWaiters.push({ resolve, reject });

        if (state.saveRunnerPromise) return;

        state.saveRunnerPromise = (async () => {
            try {
                while (state.savePending) {
                    const nextShowFeedback = state.savePendingShowFeedback;
                    const nextForceOverwrite = state.savePendingForceOverwrite;

                    state.savePending = false;
                    state.savePendingShowFeedback = false;
                    state.savePendingForceOverwrite = false;

                    await performSave(nextShowFeedback, nextForceOverwrite);
                }

                const waiters = state.saveIdleWaiters;
                state.saveIdleWaiters = [];
                waiters.forEach(w => w.resolve());
            } catch (err) {
                const waiters = state.saveIdleWaiters;
                state.saveIdleWaiters = [];
                waiters.forEach(w => w.reject(err));
            } finally {
                state.saveRunnerPromise = null;
            }
        })();
    });
}

async function performSave(showFeedback = true, forceOverwrite = false) {
    const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
    const content = getEditorHtml();

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
                        return;
                    }

                    console.log(`[SAVE OVERWRITE] User chose to overwrite conflicting version`);
                    attemptForceOverwrite = true;
                    continue;
                }

                break;
            }
        } else {
            // Create new note
            const createData = {
                title: title,
                content: content
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
            return;
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
        } else {
            state.notes.unshift(savedNote);
            state.currentNote = savedNote;
            state.originalVersion = savedNote.version != null ? Number(savedNote.version) : null; // Set version for new notes
        }

        // Re-sort by updated_at
        state.notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        // Update saved state
        state.savedTitle = savedNote.title || '';
        state.savedContent = savedNote.content || '';
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
            // For UPDATE we keep the old behavior to avoid double-rendering during note switches.
            if (saveType === 'CREATE') {
                renderNotesList(document.getElementById('searchInput').value);
            }
        } else {
            // This branch is no longer needed since we removed manual save button
            // But keeping it for safety in case showFeedback is true elsewhere
            renderNotesList(document.getElementById('searchInput').value);
        }
    } catch (error) {
        console.error(`[SAVE EXCEPTION] Error occurred during save:`, error, {
            noteId: state.currentNote?.hash_id,
            saveType: saveType,
            timestamp: new Date().toISOString()
        });
        alert('Error saving note. Please try again.');
    }
}

export function saveBeforeUnload() {
    // Save using fetch with keepalive for reliable sending during page unload
    // The keepalive flag ensures the request continues even after the page starts unloading
    const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
    const content = getEditorHtml();
    
    if (state.hasUnsavedChanges && state.currentNote) {
        console.log(`[SAVE UNLOAD] Saving before page unload`, {
            noteId: state.currentNote.hash_id,
            title: title.substring(0, 50),
            contentLength: content.length,
            timestamp: new Date().toISOString()
        });
        
        // Use fetch with keepalive flag - this is the standard way to send data during page unload
        // It's supported in all modern browsers and is more reliable than regular fetch
        fetch(API_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash_id: state.currentNote.hash_id,
                title: title,
                content: content,
                expected_version: state.originalVersion
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
                }
            });
        }).catch(err => {
            // Silently fail - page is unloading anyway
            console.error(`[SAVE UNLOAD EXCEPTION] Error during unload save:`, err);
        });
    } else if (state.hasUnsavedChanges && !state.currentNote) {
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
                content: content
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
                }
            });
        }).catch(err => {
            console.error(`[SAVE UNLOAD EXCEPTION] Error during unload create:`, err);
        });
    } else {
        console.log(`[SAVE UNLOAD] No save needed`, {
            hasNote: !!state.currentNote,
            hasUnsavedChanges: state.hasUnsavedChanges
        });
    }
}
