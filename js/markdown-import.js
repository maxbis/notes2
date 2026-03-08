import state, { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { stripHtmlTags } from './utils.js';
import { selectNote, loadNotes } from './notes.js';

let saveNote = null;
let showModal = null;

function getMarked() {
    const markedApi = window.marked;
    if (!markedApi || typeof markedApi.parse !== 'function') {
        throw new Error('Markdown parser unavailable');
    }
    return markedApi;
}

function baseNameFromFile(fileName) {
    const cleaned = String(fileName || '').trim();
    if (!cleaned) return 'Untitled';
    return cleaned.replace(/\.[^.]+$/, '').trim() || 'Untitled';
}

function hasMeaningfulHtmlContent(html) {
    return stripHtmlTags(html || '').trim().length > 0;
}

async function createImportedNote(title, content) {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content })
    });

    const savedNote = await readJsonResponse(response, 'importMarkdown:create');
    if (!response.ok || savedNote?.error) {
        throw new Error(savedNote?.error || `HTTP ${response.status}`);
    }

    return savedNote;
}

async function importMarkdownFile(file) {
    if (!file) return;

    if (state.hasUnsavedChanges && saveNote) {
        await saveNote(false);
    }

    const sourceText = await file.text();
    if (!sourceText.trim()) {
        throw new Error('The selected Markdown file is empty.');
    }

    const markedApi = getMarked();
    markedApi.setOptions({
        gfm: true,
        breaks: false
    });

    const html = markedApi.parse(sourceText);
    const title = baseNameFromFile(file.name);
    if (typeof html !== 'string' || (!html.trim() && !hasMeaningfulHtmlContent(html))) {
        throw new Error('Could not convert the Markdown file.');
    }

    const savedNote = await createImportedNote(title, html);
    await loadNotes();
    await selectNote(savedNote.hash_id);
}

export function initMarkdownImport(deps) {
    saveNote = deps.saveNote;
    showModal = deps.showModal;
}

export function setupMarkdownImport() {
    const button = document.getElementById('importMarkdownBtn');
    const input = document.getElementById('importMarkdownInput');
    if (!button || !input) return;

    button.addEventListener('click', () => {
        input.click();
    });

    input.addEventListener('change', async () => {
        const [file] = Array.from(input.files || []);
        input.value = '';
        if (!file) return;

        try {
            await importMarkdownFile(file);
        } catch (error) {
            console.error('Markdown import failed:', error);
            if (showModal) {
                await showModal('Import failed', error.message || 'Could not import the Markdown file.', 'OK', 'Close');
            } else {
                alert(error.message || 'Could not import the Markdown file.');
            }
        }
    });
}
