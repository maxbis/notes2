// CRUD operations for notes
import state, { API_ENDPOINT, AUTO_SAVE_DELAY_MS } from './state.js';
import { readJsonResponse } from './api.js';
import { setEditorHtml } from './editor.js';
import { escapeHtml, stripHtmlTags, formatDate, isMobileLayout } from './utils.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './indicators.js';
import { showDeleteConfirmDialog } from './modals.js';

// Dependencies that will be injected
let saveNote = null;
let hideNotesSidebarForEditing = null;
let showModal = null;
const GROUP_STORAGE_KEY = 'notes2.folderState';
const LIST_VIEW_STORAGE_KEY = 'notes2.listView';

const FRESHNESS_CHECK_THROTTLE_MS = 5000;
const FRESHNESS_CHECK_INTERVAL_MS = 60000;
// Must be block HTML: bare text in a contenteditable breaks Enter (insertParagraph); see editor.js EMPTY_EDITOR_HTML.
const DEFAULT_NEW_NOTE_CONTENT = '<p>empty note</p>';
let lastFreshnessCheck = 0;
let freshnessIntervalId = null;

function getRequestedNoteHashId() {
    try {
        return new URLSearchParams(window.location.search).get('note') || '';
    } catch {
        return '';
    }
}

function syncCurrentNoteToUrl(hashId) {
    try {
        const url = new URL(window.location.href);
        if (hashId) {
            url.searchParams.set('note', hashId);
        } else {
            url.searchParams.delete('note');
        }
        window.history.replaceState({}, '', url.toString());
    } catch {
        // Ignore history/url sync issues.
    }
}

function loadGroupState() {
    try {
        const stored = localStorage.getItem(GROUP_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function saveGroupState(groupState) {
    try {
        localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groupState));
    } catch (error) {
        // Ignore persistence errors (e.g. storage disabled)
    }
}

function loadListView() {
    try {
        const stored = localStorage.getItem(LIST_VIEW_STORAGE_KEY);
        if (stored === 'all' || stored === 'groups') return stored;
    } catch (error) {
        // Ignore
    }
    return 'groups';
}

function saveListView(view) {
    try {
        localStorage.setItem(LIST_VIEW_STORAGE_KEY, view);
    } catch (error) {
        // Ignore
    }
}

export function initNotes(deps) {
    saveNote = deps.saveNote;
    hideNotesSidebarForEditing = deps.hideNotesSidebarForEditing;
    showModal = deps.showModal;
}

function showStaleBanner() {
    const banner = document.getElementById('staleBanner');
    if (banner) banner.hidden = false;
}

function hideStaleBanner() {
    const banner = document.getElementById('staleBanner');
    if (banner) banner.hidden = true;
}

export async function checkFreshness() {
    if (!state.currentNote || !state.currentNote.hash_id) return;

    const now = Date.now();
    if (now - lastFreshnessCheck < FRESHNESS_CHECK_THROTTLE_MS) return;
    lastFreshnessCheck = now;

    try {
        const response = await fetch(
            `${API_ENDPOINT}?id=${state.currentNote.hash_id}&fields=version,updated_at`
        );
        const data = await readJsonResponse(response, 'checkFreshness');
        if (response.ok && data && !data.error && data.version != null) {
            const serverVersion = Number(data.version);
            const localVersion = state.originalVersion != null ? Number(state.originalVersion) : null;
            if (serverVersion > localVersion) {
                if (!state.hasUnsavedChanges) {
                    await refreshCurrentNote();
                    hideStaleBanner();
                } else {
                    showStaleBanner();
                }
            } else {
                hideStaleBanner();
            }
        }
    } catch (error) {
        console.error('Error checking freshness:', error);
    }
}

export function setupStaleBannerHandlers() {
    const banner = document.getElementById('staleBanner');
    if (!banner) return;

    const refreshBtn = banner.querySelector('.stale-banner-refresh');
    const dismissBtn = banner.querySelector('.stale-banner-dismiss');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const confirmed = showModal
                ? await showModal(
                    'Discard changes?',
                    'Refreshing will replace your unsaved changes with the version from the server.',
                    'Refresh',
                    'Cancel'
                )
                : true;
            if (confirmed) {
                hideStaleBanner();
                await refreshCurrentNote();
            }
        });
    }

    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => hideStaleBanner());
    }
}

export function startFreshnessInterval() {
    stopFreshnessInterval();
    freshnessIntervalId = setInterval(checkFreshness, FRESHNESS_CHECK_INTERVAL_MS);
}

export function stopFreshnessInterval() {
    if (freshnessIntervalId) {
        clearInterval(freshnessIntervalId);
        freshnessIntervalId = null;
    }
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
        if (Array.isArray(data)) {
            state.notes = data;
            state.publicDefaultHashId = null;
        } else {
            state.notes = Array.isArray(data.notes) ? data.notes : [];
            state.publicDefaultHashId = (data.public_default_hash_id != null && data.public_default_hash_id !== '') ? data.public_default_hash_id : null;
        }
        renderNotesList();
        if (state.notes.length > 0 && !state.currentNote) {
            const requestedHashId = getRequestedNoteHashId();
            const requestedNoteExists = requestedHashId && state.notes.some(n => n.hash_id === requestedHashId);
            selectNote(requestedNoteExists ? requestedHashId : state.notes[0].hash_id);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

export function renderNotesList(searchTerm = '') {
    const notesList = document.getElementById('notesList');
    const filteredNotes = searchTerm
        ? state.notes.filter(note => {
            const searchLower = searchTerm.toLowerCase();
            const titleLower = (note.title || '').toLowerCase();
            const contentText = stripHtmlTags(note.content || '').toLowerCase();
            return titleLower.includes(searchLower) || contentText.includes(searchLower);
          })
        : state.notes;

    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="empty-state"><p>No notes found</p></div>';
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const notesToShow = isMobile && !searchTerm ? filteredNotes.slice(0, 20) : filteredNotes;

    if (state.listView === 'all') {
        const sorted = notesToShow.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        const itemsHtml = sorted.map(note => {
            const title = note.title || 'Untitled';
            return `
            <div class="note-item ${state.currentNote && state.currentNote.hash_id === note.hash_id ? 'active' : ''}"
                 onclick="window.selectNote('${note.hash_id}')">
                <div class="note-item-header">
                    <div class="note-item-title">${escapeHtml(title)}</div>
                    <div class="note-item-date">${formatDate(note.updated_at)}</div>
                </div>
                <div class="note-item-preview">${escapeHtml(stripHtmlTags(note.content).substring(0, 100))}</div>
            </div>
            `;
        }).join('');
        notesList.innerHTML = `<div class="notes-list-flat">${itemsHtml}</div>`;
        return;
    }

    const groupState = loadGroupState();
    const groups = new Map();
    const defaultGroup = 'Other';

    notesToShow.forEach(note => {
        const rawTitle = (note.title || 'Untitled').trim();
        const dotIndex = rawTitle.indexOf('.');
        const groupName = dotIndex > 0 ? rawTitle.slice(0, dotIndex).trim() || defaultGroup : defaultGroup;
        const itemTitle = dotIndex > 0 ? rawTitle.slice(dotIndex + 1).trim() || 'Untitled' : rawTitle;
        const bucket = groups.get(groupName) || [];
        bucket.push({ note, itemTitle });
        groups.set(groupName, bucket);
    });

    notesList.innerHTML = Array.from(groups.entries()).map(([groupName, items]) => {
        const isCollapsed = groupState[groupName] === true;
        const itemsHtml = items.map(({ note, itemTitle }) => `
            <div class="note-item ${state.currentNote && state.currentNote.hash_id === note.hash_id ? 'active' : ''}"
                 onclick="window.selectNote('${note.hash_id}')">
                <div class="note-item-header">
                    <div class="note-item-title">${escapeHtml(itemTitle || 'Untitled')}</div>
                    <div class="note-item-date">${formatDate(note.updated_at)}</div>
                </div>
                <div class="note-item-preview">${escapeHtml(stripHtmlTags(note.content).substring(0, 100))}</div>
            </div>
        `).join('');

        return `
            <div class="note-group" data-group="${escapeHtml(groupName)}" data-collapsed="${isCollapsed ? 'true' : 'false'}">
                <button class="note-group-header" type="button" aria-expanded="${!isCollapsed}" data-group="${escapeHtml(groupName)}">
                    <span class="note-group-caret" aria-hidden="true"></span>
                    <span class="note-group-title">${escapeHtml(groupName)}</span>
                </button>
                <div class="note-group-items" ${isCollapsed ? 'hidden' : ''}>
                    ${itemsHtml}
                </div>
            </div>
        `;
    }).join('');

    notesList.querySelectorAll('.note-group-header').forEach(button => {
        button.addEventListener('click', () => {
            const groupName = button.dataset.group;
            const groupEl = button.closest('.note-group');
            const itemsEl = groupEl ? groupEl.querySelector('.note-group-items') : null;
            const isCollapsed = groupEl && groupEl.dataset.collapsed === 'true';
            const nextCollapsed = !isCollapsed;

            if (groupEl) {
                groupEl.dataset.collapsed = nextCollapsed ? 'true' : 'false';
            }
            button.setAttribute('aria-expanded', (!nextCollapsed).toString());
            if (itemsEl) {
                itemsEl.hidden = nextCollapsed;
            }

            if (groupName) {
                groupState[groupName] = nextCollapsed;
                saveGroupState(groupState);
            }
        });
    });
}

export function setupListViewTabs() {
    const stored = loadListView();
    if (stored === 'all' || stored === 'groups') {
        state.listView = stored;
    }

    const tabs = document.querySelectorAll('.list-view-tab');
    const searchInput = document.getElementById('searchInput');
    tabs.forEach(btn => {
        const view = btn.dataset.view;
        const isActive = state.listView === view;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.addEventListener('click', () => {
            if (state.listView === view) return;
            state.listView = view;
            saveListView(view);
            tabs.forEach(b => {
                b.classList.toggle('active', b.dataset.view === view);
                b.setAttribute('aria-selected', b.dataset.view === view ? 'true' : 'false');
            });
            renderNotesList(searchInput ? searchInput.value : '');
        });
    });
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

    syncCurrentNoteToUrl(targetHashId);

    renderNotesList(document.getElementById('searchInput').value);

    // Mobile UX: once a note is opened, hide the list to maximize editor space
    if (hideNotesSidebarForEditing) hideNotesSidebarForEditing();
}

export function openLastModifiedNote() {
    if (!state.notes.length) return;
    selectNote(state.notes[0].hash_id);
}

export async function createNewNote() {
    // Save current note if there are unsaved changes
    if (state.hasUnsavedChanges) {
        await saveNote(false);
    }
    
    state.currentNote = null;
    document.getElementById('noteTitle').value = '';
    setEditorHtml(DEFAULT_NEW_NOTE_CONTENT);
    document.getElementById('noteMeta').textContent = '';
    document.getElementById('lastSaved').textContent = '';
    
    // Reset saved state
    state.savedTitle = '';
    state.savedContent = '';
    state.hasUnsavedChanges = true;
    state.originalVersion = null;
    clearTimeout(state.autoSaveTimer);
    syncCurrentNoteToUrl('');

    updateUnsavedIndicator();
    state.autoSaveTimer = setTimeout(() => {
        if (state.hasUnsavedChanges) {
            saveNote(false);
        }
    }, AUTO_SAVE_DELAY_MS);
    
    renderNotesList(document.getElementById('searchInput').value);
    const noteContent = document.getElementById('noteContent');
    if (noteContent) {
        noteContent.focus();
        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(noteContent);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
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
        syncCurrentNoteToUrl('');
        
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
