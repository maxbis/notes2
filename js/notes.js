// CRUD operations for notes
import state, { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { setPinned } from './pin-api.js';
import { setEditorHtml } from './editor.js';
import { escapeHtml, stripHtmlTags, formatDate, isMobileLayout } from './utils.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './indicators.js';
import { showDeleteConfirmDialog } from './modals.js';
import { noteMatchesActiveTags, renderSidebarTagFilters, setCurrentTags, setSavedTags } from './tags.js';
import { renderInspector } from './inspector.js';

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

function normalizePinnedFlag(note) {
    return Number(note?.is_pinned) === 1 ? 1 : 0;
}

function sortNotesByPinnedAndUpdated(notes) {
    return [...notes].sort((left, right) => {
        const pinnedDiff = normalizePinnedFlag(right) - normalizePinnedFlag(left);
        if (pinnedDiff !== 0) return pinnedDiff;
        return new Date(right.updated_at) - new Date(left.updated_at);
    });
}

function updatePinButtons(note = null) {
    const isPinned = normalizePinnedFlag(note) === 1;
    const label = isPinned ? 'Unpin' : 'Pin';
    ['pinNoteBtn', 'pinNoteBtnMobile', 'pinNoteBtnInspector'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !note;
        btn.textContent = label;
        btn.setAttribute('aria-label', note ? `${label} this note` : 'No note selected');
        btn.setAttribute('title', note ? `${label} this note` : 'No note selected');
    });
}

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
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return Object.create(null);
        }

        // Group names are case-insensitive. Normalizing persisted keys also
        // preserves collapsed state created before grouping was normalized.
        return Object.entries(parsed).reduce((groupState, [groupName, isCollapsed]) => {
            const groupKey = normalizeGroupKey(groupName);
            groupState[groupKey] = groupState[groupKey] === true || isCollapsed === true;
            return groupState;
        }, Object.create(null));
    } catch (error) {
        return Object.create(null);
    }
}

function normalizeGroupKey(groupName) {
    return String(groupName).toLowerCase();
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
        state.notes = state.notes.map(note => ({
            ...note,
            tags: Array.isArray(note.tags) ? note.tags : [],
            is_pinned: normalizePinnedFlag(note)
        }));
        state.notes = sortNotesByPinnedAndUpdated(state.notes);
        updatePinButtons(state.currentNote);
        renderSidebarTagFilters();
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
    const searchLower = (searchTerm || '').toLowerCase();
    if (notesList) {
        notesList.classList.toggle('search-active', searchLower !== '');
    }
    const filteredNotes = state.notes.filter(note => {
        if (!noteMatchesActiveTags(note)) return false;
        if (!searchLower) return true;
        const titleLower = (note.title || '').toLowerCase();
        const contentText = stripHtmlTags(note.content || '').toLowerCase();
        const tagsText = Array.isArray(note.tags)
            ? note.tags.map(tag => String(tag || '').toLowerCase()).join(' ')
            : '';
        return titleLower.includes(searchLower)
            || contentText.includes(searchLower)
            || tagsText.includes(searchLower);
    });

    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="empty-state"><p>No notes found</p></div>';
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const notesToShow = isMobile && !searchTerm ? filteredNotes.slice(0, 20) : filteredNotes;

    if (state.listView === 'all') {
        const sorted = sortNotesByPinnedAndUpdated(notesToShow);
        const itemsHtml = sorted.map(note => {
            const title = note.title || 'Untitled';
            return `
            <div class="note-item ${state.currentNote && state.currentNote.hash_id === note.hash_id ? 'active' : ''}"
                 onclick="window.selectNote('${note.hash_id}')">
                <div class="note-item-header">
                    <div class="note-item-title">${normalizePinnedFlag(note) ? '<span class="note-item-pin" aria-hidden="true">📌</span>' : ''}${escapeHtml(title)}</div>
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
        const groupKey = normalizeGroupKey(groupName);
        const itemTitle = dotIndex > 0 ? rawTitle.slice(dotIndex + 1).trim() || 'Untitled' : rawTitle;
        const group = groups.get(groupKey) || { groupName, items: [] };
        group.items.push({ note, itemTitle });
        groups.set(groupKey, group);
    });

    notesList.innerHTML = Array.from(groups.entries()).map(([groupKey, { groupName, items }]) => {
        const isCollapsed = groupState[groupKey] === true;
        const itemsHtml = items.map(({ note, itemTitle }) => `
            <div class="note-item ${state.currentNote && state.currentNote.hash_id === note.hash_id ? 'active' : ''}"
                 onclick="window.selectNote('${note.hash_id}')">
                <div class="note-item-header">
                    <div class="note-item-title">${normalizePinnedFlag(note) ? '<span class="note-item-pin" aria-hidden="true">📌</span>' : ''}${escapeHtml(itemTitle || 'Untitled')}</div>
                    <div class="note-item-date">${formatDate(note.updated_at)}</div>
                </div>
                <div class="note-item-preview">${escapeHtml(stripHtmlTags(note.content).substring(0, 100))}</div>
            </div>
        `).join('');

        return `
            <div class="note-group" data-group="${escapeHtml(groupKey)}" data-collapsed="${isCollapsed ? 'true' : 'false'}">
                <button class="note-group-header" type="button" aria-expanded="${!isCollapsed}" data-group="${escapeHtml(groupKey)}">
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
    renderSidebarTagFilters();
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
    setCurrentTags(note.tags || []);
    
    // Update saved state
    state.savedTitle = title;
    state.savedContent = content;
    setSavedTags(note.tags || []);
    state.hasUnsavedChanges = false;
    clearTimeout(state.autoSaveTimer);
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    
    // Store original version for conflict detection
    state.originalVersion = (note && note.version != null) ? Number(note.version) : null;
    updatePinButtons(note);
    
    const updatedAt = new Date(note.updated_at);
    document.getElementById('noteMeta').textContent = 
        `Last updated: ${updatedAt.toLocaleString()}`;
    
    // Update last saved timestamp
    updateLastSavedTime(updatedAt);
    renderInspector();

    syncCurrentNoteToUrl(targetHashId);

    renderNotesList(document.getElementById('searchInput').value);

    // Mobile UX: once a note is opened, hide the list to maximize editor space
    if (hideNotesSidebarForEditing) hideNotesSidebarForEditing();
}

export function openLastModifiedNote() {
    if (!state.notes.length) return;
    const mostRecent = state.notes.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    if (mostRecent) selectNote(mostRecent.hash_id);
}

export async function togglePinnedForCurrentNote() {
    if (!state.currentNote?.hash_id) return;

    if (state.hasUnsavedChanges) {
        await saveNote(false);
        if (!state.currentNote?.hash_id) return;
    }

    const nextPinned = normalizePinnedFlag(state.currentNote) === 1 ? 0 : 1;

    try {
        const updatedNote = await setPinned(state.currentNote.hash_id, nextPinned);
        const normalizedNote = {
            ...updatedNote,
            tags: Array.isArray(updatedNote.tags) ? updatedNote.tags : [],
            is_pinned: normalizePinnedFlag(updatedNote)
        };
        const index = state.notes.findIndex(n => n.hash_id === normalizedNote.hash_id);
        if (index !== -1) {
            state.notes[index] = normalizedNote;
        }
        state.notes = sortNotesByPinnedAndUpdated(state.notes);
        state.currentNote = normalizedNote;
        updatePinButtons(normalizedNote);
        state.savedTitle = normalizedNote.title || '';
        state.savedContent = normalizedNote.content || '';
        setSavedTags(normalizedNote.tags || []);
        setCurrentTags(normalizedNote.tags || []);
        state.originalVersion = normalizedNote.version != null ? Number(normalizedNote.version) : null;

        const updatedAt = new Date(normalizedNote.updated_at);
        document.getElementById('noteMeta').textContent = `Last updated: ${updatedAt.toLocaleString()}`;
        updateLastSavedTime(updatedAt);
        renderInspector();
        renderSidebarTagFilters();
        renderNotesList(document.getElementById('searchInput').value);
    } catch (error) {
        console.error('Error toggling pin state:', error);
        alert('Error updating pin state. Please try again.');
    }
}

export async function createNewNote() {
    // Save current note if there are unsaved changes
    if (state.hasUnsavedChanges) {
        await saveNote(false);
    }
    
    state.currentNote = null;
    document.getElementById('noteTitle').value = '';
    setEditorHtml(DEFAULT_NEW_NOTE_CONTENT);
    setCurrentTags([]);
    document.getElementById('noteMeta').textContent = '';
    document.getElementById('lastSaved').textContent = '';
    
    // Reset saved state
    state.savedTitle = '';
    state.savedContent = '';
    setSavedTags([]);
    state.hasUnsavedChanges = false;
    state.originalVersion = null;
    updatePinButtons(null);
    clearTimeout(state.autoSaveTimer);
    syncCurrentNoteToUrl('');

    updateUnsavedIndicator();
    renderInspector();

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
        updatePinButtons(null);
        document.getElementById('noteTitle').value = '';
        setEditorHtml('');
        setCurrentTags([]);
        document.getElementById('noteMeta').textContent = '';
        document.getElementById('lastSaved').textContent = '';
        setSavedTags([]);
        state.originalVersion = null;
        syncCurrentNoteToUrl('');
        renderInspector();
        
        renderSidebarTagFilters();
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
            const normalizedNote = {
                ...note,
                tags: Array.isArray(note.tags) ? note.tags : [],
                is_pinned: normalizePinnedFlag(note)
            };
            // Update the note in the notes array
            const index = state.notes.findIndex(n => n.hash_id === state.currentNote.hash_id);
            if (index !== -1) {
                state.notes[index] = normalizedNote;
            }
            state.notes = sortNotesByPinnedAndUpdated(state.notes);
            
            // Reload the note
            state.currentNote = normalizedNote;
            updatePinButtons(normalizedNote);
            const title = normalizedNote.title || '';
            const content = normalizedNote.content || '';
            
            document.getElementById('noteTitle').value = title;
            setEditorHtml(content);
            setCurrentTags(normalizedNote.tags || []);
            
            state.savedTitle = title;
            state.savedContent = content;
            setSavedTags(normalizedNote.tags || []);
            state.hasUnsavedChanges = false;
            state.originalVersion = normalizedNote.version != null ? Number(normalizedNote.version) : null;
            
            // Update unsaved indicator
            updateUnsavedIndicator();
            
            const updatedAt = new Date(normalizedNote.updated_at);
            document.getElementById('noteMeta').textContent = 
                `Last updated: ${updatedAt.toLocaleString()}`;
            updateLastSavedTime(updatedAt);
            renderInspector();
            
            renderSidebarTagFilters();
            renderNotesList(document.getElementById('searchInput').value);
        }
    } catch (error) {
        console.error('Error refreshing note:', error);
    }
}
