import state from './state.js';
import { getEditorHtml } from './editor.js';
import { getCurrentTags } from './tags.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTextMetrics(text) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return { wordCount: 0, charCount: 0, readingMinutes: 0 };
    }

    const words = normalized.split(' ').filter(Boolean);
    return {
        wordCount: words.length,
        charCount: normalized.length,
        readingMinutes: Math.max(1, Math.ceil(words.length / 200))
    };
}

function parseHtmlMetrics(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');
    const text = doc.body?.textContent || '';
    const headings = Array.from(doc.body?.querySelectorAll('h1, h2, h3') || []).map((heading, index) => ({
        level: heading.tagName.toUpperCase(),
        text: (heading.textContent || '').replace(/\s+/g, ' ').trim() || `Section ${index + 1}`,
        index
    }));

    return {
        ...getTextMetrics(text),
        headings
    };
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCurrentDraftState() {
    const title = document.getElementById('noteTitle')?.value.trim() || '';
    const html = getEditorHtml() || '';
    return {
        title,
        html,
        tags: getCurrentTags()
    };
}

function syncHeadingTargets() {
    const noteContent = document.getElementById('noteContent');
    if (!noteContent) return [];

    return Array.from(noteContent.querySelectorAll('h1, h2, h3')).map((heading, index) => {
        const targetId = `inspector-heading-${index}`;
        heading.dataset.inspectorHeadingId = targetId;
        return {
            id: targetId,
            level: heading.tagName.toUpperCase(),
            text: (heading.textContent || '').replace(/\s+/g, ' ').trim() || `Section ${index + 1}`
        };
    });
}

function renderTags(tags) {
    const tagsEl = document.getElementById('noteInspectorTags');
    if (!tagsEl) return;

    if (!tags.length) {
        tagsEl.innerHTML = '<span class="inspector-chip empty">No tags yet</span>';
        return;
    }

    tagsEl.innerHTML = tags
        .map((tag) => `<span class="inspector-chip">${escapeHtml(tag)}</span>`)
        .join('');
}

function renderOutline(headings) {
    const outlineEl = document.getElementById('noteInspectorOutline');
    if (!outlineEl) return;

    syncHeadingTargets();
    if (!headings.length) {
        outlineEl.innerHTML = '<div class="inspector-outline-empty">No headings in this note yet.</div>';
        return;
    }

    outlineEl.innerHTML = headings
        .map(({ id, level, text }) => `
            <button type="button" class="inspector-outline-item" data-heading-id="${id}">
                <span class="inspector-outline-level">${level}</span>
                <span class="inspector-outline-text">${escapeHtml(text)}</span>
            </button>
        `)
        .join('');

    outlineEl.querySelectorAll('.inspector-outline-item').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.headingId;
            const target = document.querySelector(`[data-inspector-heading-id="${targetId}"]`);
            if (!(target instanceof HTMLElement)) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

export function renderInspector() {
    const emptyEl = document.getElementById('noteInspectorEmpty');
    const contentEl = document.getElementById('noteInspectorContent');
    if (!emptyEl || !contentEl) return;

    const draft = getCurrentDraftState();
    const metrics = parseHtmlMetrics(draft.html);
    const hasNote = Boolean(state.currentNote);
    const htmlTrimmed = draft.html.replace(/\s+/g, ' ').trim();
    const isBlankDraft = !hasNote && htmlTrimmed === '<p>empty note</p>' && !draft.title && !draft.tags.length;
    const hasDraftContent = !isBlankDraft && Boolean(draft.title || metrics.wordCount || draft.tags.length);

    if (!hasNote && !hasDraftContent) {
        emptyEl.hidden = false;
        contentEl.hidden = true;
        return;
    }

    emptyEl.hidden = true;
    contentEl.hidden = false;

    const updatedAt = state.currentNote?.updated_at || '';
    const createdAt = state.currentNote?.created_at || '';
    const version = state.currentNote?.version != null ? String(state.currentNote.version) : 'Draft';
    const isPinned = Number(state.currentNote?.is_pinned) === 1;
    const statusText = state.isIndicatorSaveInProgress
        ? 'Saving…'
        : state.hasUnsavedChanges
            ? 'Unsaved changes'
            : hasNote
                ? 'Saved'
                : 'Draft';

    setText('inspectorWordCount', String(metrics.wordCount));
    setText('inspectorReadingTime', `${metrics.readingMinutes} min`);
    setText('inspectorCharCount', String(metrics.charCount));
    setText('inspectorHeadingCount', String(metrics.headings.length));
    setText('inspectorCreatedAt', formatDateTime(createdAt));
    setText('inspectorUpdatedAt', formatDateTime(updatedAt));
    setText('inspectorVersion', version);

    const stateEl = document.getElementById('inspectorNoteState');
    if (stateEl) {
        stateEl.textContent = statusText;
        stateEl.classList.toggle('unsaved', state.hasUnsavedChanges && !state.isIndicatorSaveInProgress);
        stateEl.classList.toggle('saving', state.isIndicatorSaveInProgress);
    }

    const pinBadge = document.getElementById('inspectorPinBadge');
    if (pinBadge) pinBadge.hidden = !isPinned;

    renderTags(draft.tags);
    renderOutline(metrics.headings.map((heading) => ({
        ...heading,
        id: `inspector-heading-${heading.index}`
    })));
}
