// CRUD operations for notes
import state, { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { setEditorHtml } from './editor.js';
import { escapeHtml, stripHtmlTags, formatDate, isMobileLayout } from './utils.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './indicators.js';
import { showDeleteConfirmDialog } from './modals.js';

// Dependencies that will be injected
let saveNote = null;
let hideNotesSidebarForEditing = null;

export function initNotes(deps) {
    saveNote = deps.saveNote;
    hideNotesSidebarForEditing = deps.hideNotesSidebarForEditing;
}

export async function loadNotes() {
    try {
        const response = await fetch(API_ENDPOINT);
        const data = await readJsonResponse(response, 'loadNotes');
        if (!response.ok) {
            throw new Error(data?.error || `HTTP ${response.status}`);
        }
        if (data?.error) {
            throw new Error(data.error);
        }
        state.notes = Array.isArray(data) ? data : [];
        renderNotesList();
        if (state.notes.length > 0 && !state.currentNote) {
            selectNote(state.notes[0].hash_id);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

export function renderNotesList(searchTerm = '') {
    const notesList = document.getElementById('notesList');
    const filteredNotes = searchTerm 
        ? state.notes.filter(note => 
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.content.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : state.notes;

    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="empty-state"><p>No notes found</p></div>';
        return;
    }

    // On mobile, limit to 4 notes when not searching
    const isMobile = window.innerWidth <= 768;
    const notesToShow = isMobile && !searchTerm ? filteredNotes.slice(0, 4) : filteredNotes;

    notesList.innerHTML = notesToShow.map(note => `
        <div class="note-item ${state.currentNote && state.currentNote.hash_id === note.hash_id ? 'active' : ''}" 
             onclick="window.selectNote('${note.hash_id}')">
            <div class="note-item-header">
                <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-date">${formatDate(note.updated_at)}</div>
            </div>
            <div class="note-item-preview">${escapeHtml(stripHtmlTags(note.content).substring(0, 100))}</div>
        </div>
    `).join('');
}

export function filterNotes(e) {
    renderNotesList(e.target.value);
}

export async function selectNote(hashId) {
    // Save current note if there are unsaved changes
    // Save the hash_id we're switching to before saving, in case currentNote changes
    const targetHashId = hashId;
    
    if (state.hasUnsavedChanges) {
        await saveNote(false);
    }
    
    const note = state.notes.find(n => n.hash_id === targetHashId);
    if (!note) return;

    state.currentNote = note;
    const title = note.title || '';
    const content = note.content || '';
    
    document.getElementById('noteTitle').value = title;
    setEditorHtml(content);
    
    // Update saved state
    state.savedTitle = title;
    state.savedContent = content;
    state.hasUnsavedChanges = false;
    clearTimeout(state.autoSaveTimer);
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    
    // Store original version for conflict detection
    state.originalVersion = (note && note.version != null) ? Number(note.version) : null;
    
    const updatedAt = new Date(note.updated_at);
    document.getElementById('noteMeta').textContent = 
        `Last updated: ${updatedAt.toLocaleString()}`;
    
    // Update last saved timestamp
    updateLastSavedTime(updatedAt);

    renderNotesList(document.getElementById('searchInput').value);

    // Mobile UX: once a note is opened, hide the list to maximize editor space
    if (hideNotesSidebarForEditing) hideNotesSidebarForEditing();
}

export async function createNewNote() {
    // Save current note if there are unsaved changes
    if (state.hasUnsavedChanges) {
        await saveNote(false);
    }
    
    state.currentNote = null;
    document.getElementById('noteTitle').value = '';
    setEditorHtml('');
    document.getElementById('noteMeta').textContent = '';
    document.getElementById('lastSaved').textContent = '';
    
    // Reset saved state
    state.savedTitle = '';
    state.savedContent = '';
    state.hasUnsavedChanges = false;
    state.originalVersion = null;
    clearTimeout(state.autoSaveTimer);
    
    renderNotesList(document.getElementById('searchInput').value);
    document.getElementById('noteTitle').focus();
}

export async function deleteNote() {
    if (!state.currentNote) return;
    
    const confirmed = await showDeleteConfirmDialog();
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash_id: state.currentNote.hash_id
            })
        });

        const result = await readJsonResponse(response, 'deleteNote');
        
        if (result.error) {
            alert('Error deleting note: ' + result.error);
            return;
        }

        // Remove from local array
        state.notes = state.notes.filter(n => n.hash_id !== state.currentNote.hash_id);
        state.currentNote = null;
        document.getElementById('noteTitle').value = '';
        setEditorHtml('');
        document.getElementById('noteMeta').textContent = '';
        document.getElementById('lastSaved').textContent = '';
        state.originalVersion = null;
        
        renderNotesList(document.getElementById('searchInput').value);
        
        // Select first note if available
        if (state.notes.length > 0) {
            selectNote(state.notes[0].hash_id);
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note. Please try again.');
    }
}

export async function refreshCurrentNote() {
    if (!state.currentNote) return;
    
    try {
        const response = await fetch(`${API_ENDPOINT}?id=${state.currentNote.hash_id}`);
        const note = await readJsonResponse(response, 'refreshCurrentNote');
        
        if (note && !note.error) {
            // Update the note in the notes array
            const index = state.notes.findIndex(n => n.hash_id === state.currentNote.hash_id);
            if (index !== -1) {
                state.notes[index] = note;
            }
            
            // Reload the note
            state.currentNote = note;
            const title = note.title || '';
            const content = note.content || '';
            
            document.getElementById('noteTitle').value = title;
            setEditorHtml(content);
            
            state.savedTitle = title;
            state.savedContent = content;
            state.hasUnsavedChanges = false;
            state.originalVersion = note.version != null ? Number(note.version) : null;
            
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
