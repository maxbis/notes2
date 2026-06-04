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

export function looksLikeMarkdown(text) {
    const input = String(text || '');
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 3) return false;

    const mdPatterns = [
        /^#{1,6}\s+\S/m,
        /^\s*[-*+]\s+\S/m,
        /^\s*\d+\.\s+\S/m,
        /^\s*>\s+\S/m,
        /```[\s\S]*```/m,
        /\[[^\]]+\]\([^)]+\)/m,
        /(?:^|\s)(\*\*|__)[^\n]+?\1/,
        /(?:^|\s)(\*|_)[^\n]+?\1/
    ];

    const matchCount = mdPatterns.reduce((count, pattern) => count + (pattern.test(trimmed) ? 1 : 0), 0);
    return matchCount >= 1;
}

function baseNameFromFile(fileName) {
    const cleaned = String(fileName || '').trim();
    if (!cleaned) return 'Untitled';
    return cleaned.replace(/\.[^.]+$/, '').trim() || 'Untitled';
}

export function hasMeaningfulHtmlContent(html) {
    return stripHtmlTags(html || '').trim().length > 0;
}

export function convertMarkdownToHtml(markdown) {
    const sourceText = String(markdown || '');
    if (!sourceText.trim()) {
        throw new Error('The selected Markdown file is empty.');
    }

    const markedApi = getMarked();
    markedApi.setOptions({
        gfm: true,
        breaks: false
    });

    const html = markedApi.parse(sourceText);
    if (typeof html !== 'string' || (!html.trim() && !hasMeaningfulHtmlContent(html))) {
        throw new Error('Could not convert the Markdown file.');
    }

    return html;
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
    const html = convertMarkdownToHtml(sourceText);
    const title = baseNameFromFile(file.name);

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
