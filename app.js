let currentNote = null;
let notes = [];
let autoSaveTimer = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    document.getElementById('saveBtn').addEventListener('click', saveNote);
    document.getElementById('deleteBtn').addEventListener('click', deleteNote);
    document.getElementById('searchInput').addEventListener('input', filterNotes);
    
    // Auto-save on content change
    document.getElementById('noteTitle').addEventListener('input', debounceAutoSave);
    document.getElementById('noteContent').addEventListener('input', debounceAutoSave);
}

function debounceAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (currentNote) {
            saveNote(false);
        }
    }, 1000);
}

async function loadNotes() {
    try {
        const response = await fetch('index.php');
        notes = await response.json();
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

    notesList.innerHTML = filteredNotes.map(note => `
        <div class="note-item ${currentNote && currentNote.hash_id === note.hash_id ? 'active' : ''}" 
             onclick="selectNote('${note.hash_id}')">
            <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
            <div class="note-item-preview">${escapeHtml(note.content.substring(0, 100))}</div>
            <div class="note-item-date">${formatDate(note.updated_at)}</div>
        </div>
    `).join('');
}

function filterNotes(e) {
    renderNotesList(e.target.value);
}

function selectNote(hashId) {
    const note = notes.find(n => n.hash_id === hashId);
    if (!note) return;

    currentNote = note;
    document.getElementById('noteTitle').value = note.title || '';
    document.getElementById('noteContent').value = note.content || '';
    
    const updatedAt = new Date(note.updated_at);
    document.getElementById('noteMeta').textContent = 
        `Last updated: ${updatedAt.toLocaleString()}`;

    renderNotesList(document.getElementById('searchInput').value);
}

function createNewNote() {
    currentNote = null;
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteMeta').textContent = '';
    renderNotesList(document.getElementById('searchInput').value);
    document.getElementById('noteTitle').focus();
}

async function saveNote(showFeedback = true) {
    const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
    const content = document.getElementById('noteContent').value;

    try {
        let response;
        if (currentNote) {
            // Update existing note
            response = await fetch('index.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hash_id: currentNote.hash_id,
                    title: title,
                    content: content
                })
            });
        } else {
            // Create new note
            response = await fetch('index.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    content: content
                })
            });
        }

        const savedNote = await response.json();
        
        if (savedNote.error) {
            alert('Error saving note: ' + savedNote.error);
            return;
        }

        // Update local notes array
        if (currentNote) {
            const index = notes.findIndex(n => n.hash_id === currentNote.hash_id);
            if (index !== -1) {
                notes[index] = savedNote;
            }
        } else {
            notes.unshift(savedNote);
            currentNote = savedNote;
        }

        // Re-sort by updated_at
        notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        renderNotesList(document.getElementById('searchInput').value);
        
        if (showFeedback) {
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = '#34c759';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 1000);
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note. Please try again.');
    }
}

async function deleteNote() {
    if (!currentNote) return;
    
    if (!confirm('Are you sure you want to delete this note?')) {
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

        const result = await response.json();
        
        if (result.error) {
            alert('Error deleting note: ' + result.error);
            return;
        }

        // Remove from local array
        notes = notes.filter(n => n.hash_id !== currentNote.hash_id);
        currentNote = null;
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        document.getElementById('noteMeta').textContent = '';
        
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
