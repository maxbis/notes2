// Main application entry point
import state, { AUTO_SAVE_DELAY_MS } from './js/state.js';
import { isMobileLayout, getPublicLink, getEditorLink, hasMeaningfulNoteContent } from './js/utils.js';
import { setHtmlMode, getEditorHtml, formatHtmlModeTextarea } from './js/editor.js';
import { setupFormattingToolbar, initToolbar } from './js/toolbar.js';
import { insertDate, insertCheckmark } from './js/insert.js';
import { initSmartPaste } from './js/smart-paste.js';
import { saveNote, saveBeforeUnload } from './js/save.js';
import { loadNotes, renderNotesList, filterNotes, refreshNotesView, selectNote, createNewNote, deleteNote, refreshCurrentNote, initNotes, checkFreshness, setupStaleBannerHandlers, startFreshnessInterval, stopFreshnessInterval, openLastModifiedNote, setupListViewTabs, togglePinnedForCurrentNote } from './js/notes.js';
import { showModal, showLinkDialog, showConflictDialog, showDeleteConfirmDialog, showShareDialog, showPasteChoiceDialog } from './js/modals.js';
import { setPublicDefault, updateNoteSharing } from './js/api.js';
import { upsertNoteSummary } from './js/note-summary.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './js/indicators.js';
import { exportNoteToPdf } from './js/pdf-export.js';
import { initMarkdownImport, setupMarkdownImport } from './js/markdown-import.js';
import { getCurrentTags, initTagInput, tagsEqual } from './js/tags.js';
import { renderInspector } from './js/inspector.js';

// Make selectNote available globally for onclick handlers in rendered HTML
window.selectNote = selectNote;

function isMobileSearchMode() {
    return document.body.classList.contains('mobile-search-mode');
}

function updateMobileSearchButtonLabel() {
    const showNotesBtn = document.getElementById('showNotesBtn');
    if (!showNotesBtn) return;
    const inSearchMode = isMobileLayout() && isMobileSearchMode();
    showNotesBtn.textContent = inSearchMode ? 'Cancel' : '🔍';
    showNotesBtn.setAttribute('aria-label', inSearchMode ? 'Close search' : 'Search / Notes');
    showNotesBtn.setAttribute('title', inSearchMode ? 'Close search' : 'Search / Notes');
}

function showNotesSidebarAndFocusSearch() {
    if (!isMobileLayout()) return;
    document.body.classList.add('mobile-search-mode');
    document.body.classList.remove('mobile-sidebar-hidden');
    updateMobileSearchButtonLabel();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Delay focus slightly to ensure layout is visible
        setTimeout(() => searchInput.focus(), 0);
    }
}

function hideNotesSidebarForEditing() {
    if (!isMobileLayout()) return;
    document.body.classList.remove('mobile-search-mode');
    document.body.classList.add('mobile-sidebar-hidden');
    updateMobileSearchButtonLabel();
}

function closeMobileSearchMode() {
    if (!isMobileLayout()) return;
    document.body.classList.remove('mobile-search-mode');
    document.body.classList.add('mobile-sidebar-hidden');
    updateMobileSearchButtonLabel();
}

function syncMobileShellState() {
    if (isMobileLayout()) {
        updateMobileSearchButtonLabel();
        return;
    }

    document.body.classList.remove('mobile-search-mode');
    document.body.classList.remove('mobile-sidebar-hidden');
    updateMobileSearchButtonLabel();
}

function updateSearchClearButtonVisibility() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (!searchInput || !clearSearchBtn) return;
    clearSearchBtn.hidden = searchInput.value === '';
}

function closeOpenOverflowMenus(exceptMenu = null) {
    document.querySelectorAll('.overflow-menu[open]').forEach((menu) => {
        if (exceptMenu && menu === exceptMenu) return;
        menu.removeAttribute('open');
    });
}

function setupOverflowMenuDismissal() {
    document.querySelectorAll('.overflow-menu').forEach((menu) => {
        menu.addEventListener('toggle', () => {
            if (!menu.hasAttribute('open')) return;
            closeOpenOverflowMenus(menu);
        });
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('.overflow-menu')) return;
        closeOpenOverflowMenus();
    });
}

async function reloadPage() {
    const reloadBtn = document.getElementById('reloadPageBtn');
    if (reloadBtn?.disabled) return;

    if (reloadBtn) {
        reloadBtn.disabled = true;
    }

    try {
        if (!state.hasUnsavedChanges) {
            window.location.reload();
            return;
        }

        clearTimeout(state.autoSaveTimer);
        const didSave = await saveNote(false);
        if (didSave) {
            window.location.reload();
        }
    } finally {
        if (reloadBtn) {
            reloadBtn.disabled = false;
        }
    }
}

function trackChanges() {
    const title = document.getElementById('noteTitle').value.trim() || '';
    const content = getEditorHtml();
    const tags = getCurrentTags();
    
    // Check if there are actual changes
    const titleChanged = title !== state.savedTitle;
    const contentChanged = content !== state.savedContent;
    const tagsChanged = !tagsEqual(tags, state.savedTags);
    
    // For new notes, only mark as changed if there's actual content
    if (!state.currentNote) {
        state.hasUnsavedChanges = hasMeaningfulNoteContent(title, content, tags);
    } else {
        state.hasUnsavedChanges = titleChanged || contentChanged || tagsChanged;
    }
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    renderInspector();
    
    // Reset and start auto-save timer
    clearTimeout(state.autoSaveTimer);
    if (state.hasUnsavedChanges) {
        state.autoSaveTimer = setTimeout(() => {
            if (state.hasUnsavedChanges) {
                saveNote(false);
            }
        }, AUTO_SAVE_DELAY_MS);
    }
}

async function manageSharingForCurrentNote() {
    // Sharing is note-level state, so create or save the note first.
    if (!state.currentNote) {
        // Only attempt to create a note if there is any meaningful content;
        // otherwise show a gentle hint.
        const title = (document.getElementById('noteTitle')?.value || '').trim();
        const content = (getEditorHtml() || '').trim();
        const tags = getCurrentTags();

        if (!hasMeaningfulNoteContent(title, content, tags)) {
            await showModal('Sharing', 'Write something first, then publish the note.', 'OK', 'Close');
            return;
        }

        await saveNote(false);
        if (!state.currentNote || !state.currentNote.hash_id) {
            await showModal('Sharing', 'Could not create the note. Please try again.', 'OK', 'Close');
            return;
        }
    } else if (state.hasUnsavedChanges) {
        // Save first so the shared view matches what the user sees.
        await saveNote(false);
    }

    const applySharingAction = async (action) => {
        const updatedNote = await updateNoteSharing(state.currentNote.hash_id, action);
        state.currentNote = updatedNote;
        upsertNoteSummary(state.notes, updatedNote);
        if (Array.isArray(state.searchResults)) {
            upsertNoteSummary(state.searchResults, updatedNote, false);
        }
        if (action === 'disable' && state.publicDefaultHashId === updatedNote.hash_id) {
            state.publicDefaultHashId = null;
        }
        renderInspector();
        return updatedNote;
    };

    await showShareDialog({
        note: state.currentNote,
        getUrl: (note) => getPublicLink(note?.public_token),
        onPublish: () => applySharingAction('publish'),
        onDisable: () => applySharingAction('disable'),
        onRegenerate: () => applySharingAction('regenerate'),
        isEasyAccess: () => state.publicDefaultHashId === state.currentNote?.hash_id,
        onSetEasyAccess: async () => {
            const result = await setPublicDefault(state.currentNote?.hash_id ?? null);
            state.publicDefaultHashId = result.public_default_hash_id ?? null;
        },
        onRemoveEasyAccess: async () => {
            const result = await setPublicDefault(null);
            state.publicDefaultHashId = result.public_default_hash_id ?? null;
        }
    });
}

async function copyEditorLinkForCurrentNote() {
    if (!state.currentNote) {
        const title = (document.getElementById('noteTitle')?.value || '').trim();
        const content = (getEditorHtml() || '').trim();
        const tags = getCurrentTags();

        if (!hasMeaningfulNoteContent(title, content, tags)) {
            await showModal('Edit link', 'Write something first, then create an editable link.', 'OK', 'Close');
            return;
        }

        await saveNote(false);
        if (!state.currentNote || !state.currentNote.hash_id) {
            await showModal('Edit link', 'Could not create the note to generate an editable link. Please try again.', 'OK', 'Close');
            return;
        }
    } else if (state.hasUnsavedChanges) {
        await saveNote(false);
    }

    const url = getEditorLink(state.currentNote?.hash_id);
    if (!url) {
        await showModal('Edit link', 'No editable link could be generated for this note.', 'OK', 'Close');
        return;
    }

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(url);
            await showShareDialog(url, { title: 'Editable link copied' });
            return;
        }
    } catch (e) {
        console.warn('Clipboard write failed:', e);
    }

    window.prompt('Copy this editable link:', url);
}

function setupEventListeners() {
    setupOverflowMenuDismissal();
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    const openLastModifiedBtn = document.getElementById('openLastModifiedBtn');
    if (openLastModifiedBtn) {
        openLastModifiedBtn.addEventListener('click', openLastModifiedNote);
    }
    const reloadPageBtn = document.getElementById('reloadPageBtn');
    if (reloadPageBtn) {
        reloadPageBtn.addEventListener('click', reloadPage);
    }
    document.querySelectorAll('.deleteBtn').forEach((btn) => {
        btn.addEventListener('click', deleteNote);
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            updateSearchClearButtonVisibility();
            filterNotes(event);
        });
    }
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            updateSearchClearButtonVisibility();
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
        });
    }
    const showNotesBtn = document.getElementById('showNotesBtn');
    if (showNotesBtn) {
        showNotesBtn.addEventListener('click', () => {
            if (isMobileSearchMode()) {
                closeMobileSearchMode();
                return;
            }
            showNotesSidebarAndFocusSearch();
        });
    }

    const bindShare = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', async (e) => {
            // If in an overflow <details>, close it on click
            try {
                const details = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest('details') : null;
                if (details && details.hasAttribute('open')) details.removeAttribute('open');
            } catch { /* ignore */ }
            await manageSharingForCurrentNote();
        });
    };
    bindShare('shareLinkBtn');
    bindShare('shareLinkBtnMobile');
    bindShare('shareLinkBtnInspector');

    const bindEditLink = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', async (e) => {
            try {
                const details = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest('details') : null;
                if (details && details.hasAttribute('open')) details.removeAttribute('open');
            } catch { /* ignore */ }
            await copyEditorLinkForCurrentNote();
        });
    };
    bindEditLink('editLinkBtn');
    bindEditLink('editLinkBtnMobile');
    bindEditLink('editLinkBtnInspector');

    const bindPin = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', async (e) => {
            try {
                const details = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest('details') : null;
                if (details && details.hasAttribute('open')) details.removeAttribute('open');
            } catch { /* ignore */ }
            await togglePinnedForCurrentNote();
        });
    };
    bindPin('pinNoteBtn');
    bindPin('pinNoteBtnMobile');
    bindPin('pinNoteBtnInspector');
    
    // PDF export button
    ['exportPdfBtn', 'exportPdfBtnInspector'].forEach((id) => {
        const exportPdfBtn = document.getElementById(id);
        if (!exportPdfBtn) return;
        exportPdfBtn.addEventListener('click', async () => {
            await exportNoteToPdf();
        });
    });
    
    // Setup formatting toolbar
    setupFormattingToolbar();
    updateSearchClearButtonVisibility();
    const htmlModeBtn = document.getElementById('htmlModeBtn');
    if (htmlModeBtn) {
        htmlModeBtn.addEventListener('click', () => setHtmlMode(!state.isHtmlMode));
    }
    const formatHtmlBtn = document.getElementById('formatHtmlBtn');
    if (formatHtmlBtn) {
        formatHtmlBtn.addEventListener('click', () => {
            formatHtmlModeTextarea();
            trackChanges();
            document.getElementById('noteContentHtml')?.focus();
        });
    }
    const htmlModeBtnMobile = document.getElementById('htmlModeBtnMobile');
    if (htmlModeBtnMobile) {
        htmlModeBtnMobile.addEventListener('click', () => setHtmlMode(!state.isHtmlMode));
    }

    // Make the unsaved ("dirty") indicator clickable to save immediately
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    if (unsavedIndicator) {
        unsavedIndicator.setAttribute('role', 'button');
        // Don't let it steal focus/caret unless it's actually visible and actionable.
        unsavedIndicator.setAttribute('tabindex', '-1');
        unsavedIndicator.setAttribute('aria-label', 'Saved');

        const triggerSaveFromIndicator = async () => {
            if (!state.hasUnsavedChanges) return;
            if (state.isIndicatorSaveInProgress) return;

            const previouslyFocused = document.activeElement;
            state.isIndicatorSaveInProgress = true;
            clearTimeout(state.autoSaveTimer);
            renderInspector();

            try {
                await saveNote(true);
            } finally {
                state.isIndicatorSaveInProgress = false;
                renderInspector();
                // Restore focus so caret doesn't "disappear" after clicking the indicator.
                // Prefer restoring prior focus if it was in the editor; otherwise focus the editor.
                const restore =
                    previouslyFocused &&
                    (previouslyFocused.id === 'noteTitle' ||
                        previouslyFocused.id === 'noteContent' ||
                        previouslyFocused.id === 'noteContentHtml')
                        ? previouslyFocused
                        : document.getElementById(state.isHtmlMode ? 'noteContentHtml' : 'noteContent');
                if (restore && typeof restore.focus === 'function') restore.focus();
            }
        };

        // Prevent the indicator from taking focus away from the editor on click/tap.
        unsavedIndicator.addEventListener('pointerdown', (e) => {
            if (state.hasUnsavedChanges) e.preventDefault();
        });
        unsavedIndicator.addEventListener('click', triggerSaveFromIndicator);
        // Note: keep it clickable, but don't rely on keyboard focus here
        // (it can cause caret/focus confusion while typing).
    }
    
    // Track changes on content change
    document.getElementById('noteTitle').addEventListener('input', trackChanges);
    document.getElementById('noteContent').addEventListener('input', trackChanges);
    initTagInput(trackChanges);
    const noteContentHtml = document.getElementById('noteContentHtml');
    if (noteContentHtml) {
        noteContentHtml.addEventListener('input', () => {
            state.htmlModeDirty = true;
            state.htmlModeRawHtml = noteContentHtml.value;
            trackChanges();
        });
    }

    // Mobile UX: tapping into the editor should hide the notes list
    document.getElementById('noteTitle').addEventListener('focus', hideNotesSidebarForEditing);
    document.getElementById('noteContent').addEventListener('focus', hideNotesSidebarForEditing);
    if (noteContentHtml) {
        noteContentHtml.addEventListener('focus', hideNotesSidebarForEditing);
        noteContentHtml.addEventListener('pointerdown', hideNotesSidebarForEditing);
    }
    document.getElementById('noteTitle').addEventListener('pointerdown', hideNotesSidebarForEditing);
    document.getElementById('noteContent').addEventListener('pointerdown', hideNotesSidebarForEditing);
    window.addEventListener('resize', syncMobileShellState);
    
    // Save on tab switch or page hide through the normal queued save path.
    // This reduces overlap with unload-specific saves while still flushing dirty edits
    // when the user moves to another tab or app.
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            if (state.hasUnsavedChanges) {
                clearTimeout(state.autoSaveTimer);
                await saveNote(false);
            }
            stopFreshnessInterval();
        } else {
            checkFreshness();
            startFreshnessInterval();
        }
    });

    // Check freshness when window gains focus (e.g. switching back from another app)
    window.addEventListener('focus', checkFreshness);

    setupStaleBannerHandlers();
    
    // Save on page leave (closing tab/browser, navigating away)
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            // Save synchronously before leaving
            saveBeforeUnload();
        }
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize module dependencies
    initToolbar({
        trackChanges,
        showLinkDialog,
        insertDate,
        insertCheckmark
    });
    
    initNotes({
        saveNote,
        hideNotesSidebarForEditing,
        showModal
    });

    initMarkdownImport({
        saveNote,
        showModal
    });

    initSmartPaste({
        showPasteChoiceDialog
    });
    
    // Import save module and initialize it
    const { initSave } = await import('./js/save.js');
    initSave({
        showConflictDialog,
        refreshCurrentNote,
        renderNotesList,
        refreshNotesView
    });
    
    setupListViewTabs();
    loadNotes();
    setupEventListeners();
    setupMarkdownImport();
    // Ensure we start in WYSIWYG mode (HTML textarea hidden)
    setHtmlMode(false);
    // Initialize unsaved indicator state
    updateUnsavedIndicator();
    renderInspector();
    // Start freshness check and timer when tab is visible
    if (!document.hidden) {
        checkFreshness();
        startFreshnessInterval();
    }
    syncMobileShellState();
});
