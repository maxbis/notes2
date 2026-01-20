let currentNote = null;
let notes = [];
let autoSaveTimer = null;
let hasUnsavedChanges = false;
let savedTitle = '';
let savedContent = '';
let originalUpdatedAt = null; // Store original timestamp for conflict detection
let pendingSaveAction = null; // Store pending save callback
let isIndicatorSaveInProgress = false;

function isMobileLayout() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

function showNotesSidebarAndFocusSearch() {
    document.body.classList.remove('mobile-sidebar-hidden');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Delay focus slightly to ensure layout is visible
        setTimeout(() => searchInput.focus(), 0);
    }
}

function hideNotesSidebarForEditing() {
    if (!isMobileLayout()) return;
    document.body.classList.add('mobile-sidebar-hidden');
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    setupEventListeners();
    // Initialize unsaved indicator state
    updateUnsavedIndicator();
});

async function readJsonResponse(response, context = 'request') {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        const snippet = text.slice(0, 300);
        const err = new Error(`[${context}] Expected JSON but got: ${snippet}`);
        err.cause = e;
        err.status = response.status;
        throw err;
    }
}

function setupEventListeners() {
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    document.getElementById('deleteBtn').addEventListener('click', deleteNote);
    document.getElementById('searchInput').addEventListener('input', filterNotes);
    const showNotesBtn = document.getElementById('showNotesBtn');
    if (showNotesBtn) {
        showNotesBtn.addEventListener('click', () => {
            showNotesSidebarAndFocusSearch();
        });
    }
    
    // Setup formatting toolbar
    setupFormattingToolbar();

    // Make the unsaved ("dirty") indicator clickable to save immediately
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    if (unsavedIndicator) {
        unsavedIndicator.setAttribute('role', 'button');
        unsavedIndicator.setAttribute('tabindex', '0');
        unsavedIndicator.setAttribute('aria-label', 'Unsaved changes indicator');

        const triggerSaveFromIndicator = async () => {
            if (!hasUnsavedChanges) return;
            if (isIndicatorSaveInProgress) return;

            isIndicatorSaveInProgress = true;
            clearTimeout(autoSaveTimer);

            try {
                await saveNote(true);
            } finally {
                isIndicatorSaveInProgress = false;
            }
        };

        unsavedIndicator.addEventListener('click', triggerSaveFromIndicator);
        unsavedIndicator.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerSaveFromIndicator();
            }
        });
    }
    
    // Track changes on content change
    document.getElementById('noteTitle').addEventListener('input', trackChanges);
    document.getElementById('noteContent').addEventListener('input', trackChanges);

    // Mobile UX: tapping into the editor should hide the notes list
    document.getElementById('noteTitle').addEventListener('focus', hideNotesSidebarForEditing);
    document.getElementById('noteContent').addEventListener('focus', hideNotesSidebarForEditing);
    document.getElementById('noteTitle').addEventListener('pointerdown', hideNotesSidebarForEditing);
    document.getElementById('noteContent').addEventListener('pointerdown', hideNotesSidebarForEditing);
    
    // Save on tab switch or page hide
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && hasUnsavedChanges) {
            // Save when tab becomes hidden (user switches tab or minimizes)
            saveBeforeUnload();
        }
    });
    
    // Save on page leave (closing tab/browser, navigating away)
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            // Save synchronously before leaving
            saveBeforeUnload();
        }
    });
    
    // Also save when window loses focus (user clicks away)
    window.addEventListener('blur', () => {
        if (hasUnsavedChanges) {
            saveBeforeUnload();
        }
    });
    
}

function setupFormattingToolbar() {
    document.getElementById('boldBtn').addEventListener('click', () => {
        document.execCommand('bold', false, null);
        document.getElementById('noteContent').focus();
        trackChanges();
    });
    
    document.getElementById('italicBtn').addEventListener('click', () => {
        document.execCommand('italic', false, null);
        document.getElementById('noteContent').focus();
        trackChanges();
    });
    
    document.getElementById('bulletListBtn').addEventListener('click', () => {
        document.execCommand('insertUnorderedList', false, null);
        document.getElementById('noteContent').focus();
        trackChanges();
    });
    
    document.getElementById('numberedListBtn').addEventListener('click', () => {
        document.execCommand('insertOrderedList', false, null);
        document.getElementById('noteContent').focus();
        trackChanges();
    });

    document.getElementById('h1Btn').addEventListener('click', () => {
        document.execCommand('formatBlock', false, 'h1');
        document.getElementById('noteContent').focus();
        trackChanges();
    });

    document.getElementById('h2Btn').addEventListener('click', () => {
        document.execCommand('formatBlock', false, 'h2');
        document.getElementById('noteContent').focus();
        trackChanges();
    });

    document.getElementById('h3Btn').addEventListener('click', () => {
        document.execCommand('formatBlock', false, 'h3');
        document.getElementById('noteContent').focus();
        trackChanges();
    });

    document.getElementById('preBtn').addEventListener('click', () => {
        document.execCommand('formatBlock', false, 'pre');
        document.getElementById('noteContent').focus();
        trackChanges();
    });
    
    document.getElementById('insertDateBtn').addEventListener('click', () => {
        insertDate();
        trackChanges();
    });
    
    document.getElementById('insertCheckmarkBtn').addEventListener('click', () => {
        insertCheckmark();
        trackChanges();
    });
    
    // Keyboard shortcuts
    document.getElementById('noteContent').addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold', false, null);
                setTimeout(trackChanges, 0);
            } else if (e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic', false, null);
                setTimeout(trackChanges, 0);
            }
        }
    });

    // Inline shortcuts:
    // - type ";d" to insert date
    // - type ";v" to insert a checkmark
    document.getElementById('noteContent').addEventListener('beforeinput', (e) => {
        // Only handle literal character insertions (avoid paste, delete, IME composition, etc.)
        if (e.inputType !== 'insertText' || typeof e.data !== 'string') return;
        if (e.data !== 'd' && e.data !== 'v') return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;

        const { node, offset } = getTextNodeAndOffsetAtCaret(range);
        if (!node || offset < 1) return;

        // Only trigger if the character immediately before the caret is ';'
        if (node.data[offset - 1] !== ';') return;

        // Prevent inserting the typed character ('d'/'v'), then replace ";d"/";v"
        e.preventDefault();

        // Delete the ';' before the caret
        const deleteRange = document.createRange();
        deleteRange.setStart(node, offset - 1);
        deleteRange.setEnd(node, offset);
        deleteRange.deleteContents();

        // Place caret where the ';' was, then insert replacement
        const newRange = document.createRange();
        newRange.setStart(node, offset - 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        if (e.data === 'd') {
            insertDate();
        } else {
            insertCheckmark();
        }
        trackChanges();
    });
    
    // Update toolbar button states based on selection
    document.getElementById('noteContent').addEventListener('input', updateToolbarState);
    document.addEventListener('selectionchange', updateToolbarState);
    document.getElementById('noteContent').addEventListener('mouseup', updateToolbarState);
    document.getElementById('noteContent').addEventListener('keyup', updateToolbarState);
}

function getTextNodeAndOffsetAtCaret(range) {
    const container = range.startContainer;
    const offset = range.startOffset;

    // Common case: caret is inside a text node
    if (container && container.nodeType === Node.TEXT_NODE) {
        return { node: container, offset };
    }

    // Fallback: caret is in an element node, try to find a nearby text node
    if (!container || container.nodeType !== Node.ELEMENT_NODE) {
        return { node: null, offset: 0 };
    }

    // Try text node immediately before the caret position
    const childBefore = offset > 0 ? container.childNodes[offset - 1] : null;
    if (childBefore) {
        const lastText = findLastTextNode(childBefore);
        if (lastText) return { node: lastText, offset: lastText.data.length };
    }

    return { node: null, offset: 0 };
}

function findLastTextNode(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) return node;
    // Walk backwards through descendants
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const found = findLastTextNode(node.childNodes[i]);
        if (found) return found;
    }
    return null;
}

function updateToolbarState() {
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    
    if (document.activeElement === document.getElementById('noteContent')) {
        boldBtn.classList.toggle('active', document.queryCommandState('bold'));
        italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    }
}

function insertDate() {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();
    
    // Get current date in European format (Dutch)
    const now = new Date();
    const dateString = now.toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Insert the date at the current cursor position
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(dateString);
        range.insertNode(textNode);
        
        // Move cursor to the end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If no selection, append at the end
        editor.focus();
        const textNode = document.createTextNode(dateString);
        editor.appendChild(textNode);
    }
    
    editor.focus();
}

function insertCheckmark() {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();
    
    // Insert checkmark at the current cursor position
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode('✅ ');
        range.insertNode(textNode);
        
        // Move cursor to the end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If no selection, append at the end
        editor.focus();
        const textNode = document.createTextNode('✅ ');
        editor.appendChild(textNode);
    }
    
    editor.focus();
}

function trackChanges() {
    const title = document.getElementById('noteTitle').value.trim() || '';
    const content = document.getElementById('noteContent').innerHTML;
    
    // Check if there are actual changes
    const titleChanged = title !== savedTitle;
    const contentChanged = content !== savedContent;
    
    // For new notes, only mark as changed if there's actual content
    // Check for meaningful content by checking if innerHTML has more than just empty tags/whitespace
    if (!currentNote) {
        const hasContent = title.length > 0 || 
            (content.trim().length > 0 && content.replace(/<[^>]*>/g, '').trim().length > 0);
        hasUnsavedChanges = hasContent;
    } else {
        hasUnsavedChanges = titleChanged || contentChanged;
    }
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    
    // Reset and start auto-save timer (20 seconds)
    clearTimeout(autoSaveTimer);
    if (hasUnsavedChanges) {
        autoSaveTimer = setTimeout(() => {
            if (hasUnsavedChanges) {
                saveNote(false);
            }
        }, 4000);
    }
}

function saveBeforeUnload() {
    // Save using fetch with keepalive for reliable sending during page unload
    // The keepalive flag ensures the request continues even after the page starts unloading
    const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
    const content = document.getElementById('noteContent').innerHTML;
    
    if (hasUnsavedChanges && currentNote) {
        console.log(`[SAVE UNLOAD] Saving before page unload`, {
            noteId: currentNote.hash_id,
            title: title.substring(0, 50),
            contentLength: content.length,
            timestamp: new Date().toISOString()
        });
        
        // Use fetch with keepalive flag - this is the standard way to send data during page unload
        // It's supported in all modern browsers and is more reliable than regular fetch
        fetch('index.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash_id: currentNote.hash_id,
                title: title,
                content: content
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
    } else if (hasUnsavedChanges && !currentNote) {
        // New note that hasn't been created on the server yet — try to create it on unload.
        console.log(`[SAVE UNLOAD] Creating new note before page unload`, {
            title: title.substring(0, 50),
            contentLength: content.length,
            timestamp: new Date().toISOString()
        });

        fetch('index.php', {
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
            hasNote: !!currentNote,
            hasUnsavedChanges: hasUnsavedChanges
        });
    }
}


async function loadNotes() {
    try {
        const response = await fetch('index.php');
        const data = await readJsonResponse(response, 'loadNotes');
        if (!response.ok) {
            throw new Error(data?.error || `HTTP ${response.status}`);
        }
        if (data?.error) {
            throw new Error(data.error);
        }
        notes = Array.isArray(data) ? data : [];
        renderNotesList();
        if (notes.length > 0 && !currentNote) {
            selectNote(notes[0].hash_id);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

function renderNotesList(searchTerm = '') {
    const notesList = document.getElementById('notesList');
    const filteredNotes = searchTerm 
        ? notes.filter(note => 
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.content.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : notes;

    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="empty-state"><p>No notes found</p></div>';
        return;
    }

    // On mobile, limit to 4 notes when not searching
    const isMobile = window.innerWidth <= 768;
    const notesToShow = isMobile && !searchTerm ? filteredNotes.slice(0, 4) : filteredNotes;

    notesList.innerHTML = notesToShow.map(note => `
        <div class="note-item ${currentNote && currentNote.hash_id === note.hash_id ? 'active' : ''}" 
             onclick="selectNote('${note.hash_id}')">
            <div class="note-item-header">
                <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-date">${formatDate(note.updated_at)}</div>
            </div>
            <div class="note-item-preview">${escapeHtml(stripHtmlTags(note.content).substring(0, 100))}</div>
        </div>
    `).join('');
}

function filterNotes(e) {
    renderNotesList(e.target.value);
}

async function selectNote(hashId) {
    // Save current note if there are unsaved changes
    // Save the hash_id we're switching to before saving, in case currentNote changes
    const targetHashId = hashId;
    
    if (hasUnsavedChanges) {
        await saveNote(false);
    }
    
    const note = notes.find(n => n.hash_id === targetHashId);
    if (!note) return;

    currentNote = note;
    const title = note.title || '';
    const content = note.content || '';
    
    document.getElementById('noteTitle').value = title;
    document.getElementById('noteContent').innerHTML = content;
    
    // Update saved state
    savedTitle = title;
    savedContent = content;
    hasUnsavedChanges = false;
    clearTimeout(autoSaveTimer);
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    
    // Store original timestamp for conflict detection
    originalUpdatedAt = note.updated_at;
    
    const updatedAt = new Date(note.updated_at);
    document.getElementById('noteMeta').textContent = 
        `Last updated: ${updatedAt.toLocaleString()}`;
    
    // Update last saved timestamp
    updateLastSavedTime(updatedAt);

    renderNotesList(document.getElementById('searchInput').value);

    // Mobile UX: once a note is opened, hide the list to maximize editor space
    hideNotesSidebarForEditing();
}

async function createNewNote() {
    // Save current note if there are unsaved changes
    if (hasUnsavedChanges) {
        await saveNote(false);
    }
    
    currentNote = null;
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').innerHTML = '';
    document.getElementById('noteMeta').textContent = '';
    document.getElementById('lastSaved').textContent = '';
    
    // Reset saved state
    savedTitle = '';
    savedContent = '';
    hasUnsavedChanges = false;
    originalUpdatedAt = null;
    clearTimeout(autoSaveTimer);
    
    renderNotesList(document.getElementById('searchInput').value);
    document.getElementById('noteTitle').focus();
}

async function saveNote(showFeedback = true, forceOverwrite = false) {
    const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
    const content = document.getElementById('noteContent').innerHTML;
    
    const timestamp = new Date().toISOString();
    const saveType = currentNote ? 'UPDATE' : 'CREATE';
    console.log(`[SAVE ${saveType}] ${timestamp} - Starting save operation`, {
        noteId: currentNote?.hash_id || 'NEW',
        title: title.substring(0, 50),
        contentLength: content.length,
        showFeedback,
        forceOverwrite,
        originalUpdatedAt
    });

    try {
        let response;
        if (currentNote) {
            // Check for conflicts before saving
            if (!forceOverwrite && originalUpdatedAt) {
                console.log(`[SAVE CONFLICT CHECK] Checking for conflicts...`, {
                    currentTimestamp: originalUpdatedAt
                });
                // Fetch current version from server to check timestamp
                const checkResponse = await fetch(`index.php?id=${currentNote.hash_id}`);
                const serverNote = await readJsonResponse(checkResponse, 'conflictCheck');
                
                if (serverNote && serverNote.updated_at !== originalUpdatedAt) {
                    // Conflict detected!
                    console.warn(`[SAVE CONFLICT DETECTED]`, {
                        localTimestamp: originalUpdatedAt,
                        serverTimestamp: serverNote.updated_at,
                        serverTitle: serverNote.title?.substring(0, 50)
                    });
                    const serverUpdatedAt = new Date(serverNote.updated_at);
                    const conflictResolved = await showConflictDialog(
                        serverUpdatedAt,
                        serverNote.title,
                        serverNote.content
                    );
                    
                    if (!conflictResolved) {
                        // User cancelled, refresh the note
                        console.log(`[SAVE CANCELLED] User chose to cancel and refresh due to conflict`);
                        await refreshCurrentNote();
                        return;
                    }
                    // User chose to overwrite, continue with save
                    console.log(`[SAVE OVERWRITE] User chose to overwrite conflicting version`);
                } else {
                    console.log(`[SAVE NO CONFLICT] Timestamps match, safe to save`);
                }
            }
            
            // Update existing note
            const updateData = {
                hash_id: currentNote.hash_id,
                title: title,
                content: content,
                original_updated_at: originalUpdatedAt
            };
            console.log(`[SAVE UPDATE] Sending PUT request`, {
                hash_id: currentNote.hash_id,
                titleLength: title.length,
                contentLength: content.length
            });
            response = await fetch('index.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });
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
            response = await fetch('index.php', {
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
                noteId: currentNote?.hash_id,
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
        if (currentNote) {
            const index = notes.findIndex(n => n.hash_id === currentNote.hash_id);
            if (index !== -1) {
                notes[index] = savedNote;
            }
        } else {
            notes.unshift(savedNote);
            currentNote = savedNote;
            originalUpdatedAt = savedNote.updated_at; // Set timestamp for new notes
        }

        // Re-sort by updated_at
        notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        // Update saved state
        savedTitle = savedNote.title || '';
        savedContent = savedNote.content || '';
        hasUnsavedChanges = false;
        clearTimeout(autoSaveTimer);
        
        // Update unsaved indicator
        updateUnsavedIndicator();
        
        // Update original timestamp after successful save
        originalUpdatedAt = savedNote.updated_at;
        
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
            noteId: currentNote?.hash_id,
            saveType: saveType,
            timestamp: new Date().toISOString()
        });
        alert('Error saving note. Please try again.');
    }
}

async function deleteNote() {
    if (!currentNote) return;
    
    const confirmed = await showDeleteConfirmDialog();
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch('index.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash_id: currentNote.hash_id
            })
        });

        const result = await readJsonResponse(response, 'deleteNote');
        
        if (result.error) {
            alert('Error deleting note: ' + result.error);
            return;
        }

        // Remove from local array
        notes = notes.filter(n => n.hash_id !== currentNote.hash_id);
        currentNote = null;
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').innerHTML = '';
        document.getElementById('noteMeta').textContent = '';
        document.getElementById('lastSaved').textContent = '';
        originalUpdatedAt = null;
        
        renderNotesList(document.getElementById('searchInput').value);
        
        // Select first note if available
        if (notes.length > 0) {
            selectNote(notes[0].hash_id);
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note. Please try again.');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtmlTags(html) {
    // Create a temporary DOM element to parse HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Get text content which automatically strips all HTML tags
    return tmp.textContent || tmp.innerText || '';
}

function updateUnsavedIndicator() {
    const indicator = document.getElementById('unsavedIndicator');
    if (!indicator) return;
    
    if (hasUnsavedChanges) {
        indicator.classList.add('visible');
        indicator.title = isIndicatorSaveInProgress
            ? 'Saving...'
            : 'Unsaved changes — click to save now';
        indicator.setAttribute('aria-label', 'Unsaved changes — click to save now');
    } else {
        indicator.classList.remove('visible');
        indicator.title = 'Saved';
        indicator.setAttribute('aria-label', 'Saved');
    }
}

function updateLastSavedTime(date) {
    const lastSavedEl = document.getElementById('lastSaved');
    if (!lastSavedEl) return;
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    lastSavedEl.textContent = `Saved at ${hours}:${minutes}:${seconds}`;
}

// Modal Dialog Functions
function showModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        
        overlay.classList.add('active');
        
        const handleConfirm = () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
    });
}

async function showConflictDialog(serverUpdatedAt, serverTitle, serverContent) {
    const serverTime = serverUpdatedAt.toLocaleString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    const message = `This note was modified by another session and saved at ${serverTime}.\n\n` +
                   `Your current changes will overwrite those changes.\n\n` +
                   `Do you want to overwrite the server version?`;
    
    const confirmed = await showModal(
        '⚠️ Conflict Detected',
        message,
        'Overwrite',
        'Cancel & Refresh'
    );
    
    return confirmed;
}

async function showDeleteConfirmDialog() {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    
    titleEl.textContent = 'Delete Note';
    messageEl.textContent = 'Are you sure you want to delete this note? This action cannot be undone.';
    confirmBtn.textContent = 'Delete';
    cancelBtn.textContent = 'Cancel';
    
    // Add danger class for delete button
    confirmBtn.classList.add('btn-danger');
    confirmBtn.classList.remove('btn-primary');
    
    overlay.classList.add('active');
    
    return new Promise((resolve) => {
        const handleConfirm = () => {
            overlay.classList.remove('active');
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
    });
}

async function refreshCurrentNote() {
    if (!currentNote) return;
    
    try {
        const response = await fetch(`index.php?id=${currentNote.hash_id}`);
        const note = await readJsonResponse(response, 'refreshCurrentNote');
        
        if (note && !note.error) {
            // Update the note in the notes array
            const index = notes.findIndex(n => n.hash_id === currentNote.hash_id);
            if (index !== -1) {
                notes[index] = note;
            }
            
            // Reload the note
            currentNote = note;
            const title = note.title || '';
            const content = note.content || '';
            
            document.getElementById('noteTitle').value = title;
            document.getElementById('noteContent').innerHTML = content;
            
            savedTitle = title;
            savedContent = content;
            hasUnsavedChanges = false;
            originalUpdatedAt = note.updated_at;
            
            // Update unsaved indicator
            updateUnsavedIndicator();
            
            const updatedAt = new Date(note.updated_at);
            document.getElementById('noteMeta').textContent = 
                `Last updated: ${updatedAt.toLocaleString()}`;
            updateLastSavedTime(updatedAt);
            
            renderNotesList(document.getElementById('searchInput').value);
        }
    } catch (error) {
        console.error('Error refreshing note:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}
