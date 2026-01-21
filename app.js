// Main application entry point
import state from './js/state.js';
import { isMobileLayout, getPublicLink } from './js/utils.js';
import { setHtmlMode, getEditorHtml } from './js/editor.js';
import { setupFormattingToolbar, initToolbar, updateToolbarState } from './js/toolbar.js';
import { insertDate, insertCheckmark } from './js/insert.js';
import { saveNote, saveBeforeUnload } from './js/save.js';
import { loadNotes, renderNotesList, filterNotes, selectNote, createNewNote, deleteNote, refreshCurrentNote, initNotes } from './js/notes.js';
import { showModal, showLinkDialog, showConflictDialog, showDeleteConfirmDialog } from './js/modals.js';
import { updateUnsavedIndicator, updateLastSavedTime } from './js/indicators.js';
import { exportNoteToPdf } from './js/pdf-export.js';

// Make selectNote available globally for onclick handlers in rendered HTML
window.selectNote = selectNote;

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

function trackChanges() {
    const title = document.getElementById('noteTitle').value.trim() || '';
    const content = getEditorHtml();
    
    // Check if there are actual changes
    const titleChanged = title !== state.savedTitle;
    const contentChanged = content !== state.savedContent;
    
    // For new notes, only mark as changed if there's actual content
    // Check for meaningful content by checking if innerHTML has more than just empty tags/whitespace
    if (!state.currentNote) {
        const hasContent = title.length > 0 || 
            (content.trim().length > 0 && content.replace(/<[^>]*>/g, '').trim().length > 0);
        state.hasUnsavedChanges = hasContent;
    } else {
        state.hasUnsavedChanges = titleChanged || contentChanged;
    }
    
    // Update unsaved indicator
    updateUnsavedIndicator();
    
    // Reset and start auto-save timer (4 seconds)
    clearTimeout(state.autoSaveTimer);
    if (state.hasUnsavedChanges) {
        state.autoSaveTimer = setTimeout(() => {
            if (state.hasUnsavedChanges) {
                saveNote(false);
            }
        }, 4000);
    }
}

async function copyPublicLinkForCurrentNote() {
    // Ensure we have a note hash id. If it's a new note, save first.
    if (!state.currentNote) {
        // Only attempt to create a note if there is any meaningful content;
        // otherwise show a gentle hint.
        const title = (document.getElementById('noteTitle')?.value || '').trim();
        const content = (getEditorHtml() || '').trim();
        const hasMeaningfulContent =
            title.length > 0 ||
            (content.length > 0 && content.replace(/<[^>]*>/g, '').trim().length > 0);

        if (!hasMeaningfulContent) {
            await showModal('Share link', 'Write something first, then share the note.', 'OK', 'Close');
            return;
        }

        await saveNote(false);
        if (!state.currentNote || !state.currentNote.hash_id) {
            await showModal('Share link', 'Could not create the note to generate a link. Please try again.', 'OK', 'Close');
            return;
        }
    } else if (state.hasUnsavedChanges) {
        // Save first so the shared view matches what the user sees.
        await saveNote(false);
    }

    const url = getPublicLink(state.currentNote?.hash_id);
    if (!url) {
        await showModal('Share link', 'No link could be generated for this note.', 'OK', 'Close');
        return;
    }

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(url);
            await showModal('Share link copied', url, 'OK', 'Close');
            return;
        }
    } catch (e) {
        // fall through to prompt fallback
        console.warn('Clipboard write failed:', e);
    }

    // Fallback: prompt lets the user copy manually in older browsers / insecure contexts.
    // eslint-disable-next-line no-alert
    window.prompt('Copy this public link:', url);
}

function setupEventListeners() {
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    document.querySelectorAll('.deleteBtn').forEach((btn) => {
        btn.addEventListener('click', deleteNote);
    });
    document.getElementById('searchInput').addEventListener('input', filterNotes);
    const showNotesBtn = document.getElementById('showNotesBtn');
    if (showNotesBtn) {
        showNotesBtn.addEventListener('click', () => {
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
            await copyPublicLinkForCurrentNote();
        });
    };
    bindShare('shareLinkBtn');
    bindShare('shareLinkBtnMobile');
    
    // PDF export button
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            await exportNoteToPdf();
        });
    }
    
    // Setup formatting toolbar
    setupFormattingToolbar();
    const htmlModeBtn = document.getElementById('htmlModeBtn');
    if (htmlModeBtn) {
        htmlModeBtn.addEventListener('click', () => setHtmlMode(!state.isHtmlMode));
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

            try {
                await saveNote(true);
            } finally {
                state.isIndicatorSaveInProgress = false;
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
    
    // Save on tab switch or page hide
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.hasUnsavedChanges) {
            // Save when tab becomes hidden (user switches tab or minimizes)
            saveBeforeUnload();
        }
    });
    
    // Save on page leave (closing tab/browser, navigating away)
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            // Save synchronously before leaving
            saveBeforeUnload();
        }
    });
    
    // Also save when window loses focus (user clicks away)
    window.addEventListener('blur', () => {
        if (state.hasUnsavedChanges) {
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
        hideNotesSidebarForEditing
    });
    
    // Import save module and initialize it
    const { initSave } = await import('./js/save.js');
    initSave({
        showConflictDialog,
        refreshCurrentNote,
        renderNotesList
    });
    
    loadNotes();
    setupEventListeners();
    // Ensure we start in WYSIWYG mode (HTML textarea hidden)
    setHtmlMode(false);
    // Initialize unsaved indicator state
    updateUnsavedIndicator();
});
