const SEARCH_HIGHLIGHT_NAME = 'notes-search-match';
const SEARCH_HIGHLIGHT_ATTRIBUTE = 'data-notes-search-highlight';

function getHighlightRegistry() {
    return globalThis.CSS?.highlights || null;
}

export function clearSearchHighlights() {
    getHighlightRegistry()?.delete(SEARCH_HIGHLIGHT_NAME);

    const editor = document.getElementById('noteContent');
    if (!editor) return;

    const affectedParents = new Set();
    editor.querySelectorAll(`mark[${SEARCH_HIGHLIGHT_ATTRIBUTE}]`).forEach((mark) => {
        if (mark.parentNode) affectedParents.add(mark.parentNode);
        mark.replaceWith(...mark.childNodes);
    });
    affectedParents.forEach((parent) => parent.normalize());
}

function findTextMatches(root, searchTerm) {
    const normalizedTerm = String(searchTerm || '').trim().replace(/\s+/gu, ' ');
    if (!root || !normalizedTerm) return [];

    const ranges = [];
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escapedTerm, 'giu');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
        const text = textNode.textContent || '';
        for (const match of text.matchAll(matcher)) {
            const matchIndex = match.index;
            if (matchIndex == null) continue;
            const range = document.createRange();
            range.setStart(textNode, matchIndex);
            range.setEnd(textNode, matchIndex + match[0].length);
            ranges.push(range);
        }

        textNode = walker.nextNode();
    }

    return ranges;
}

function scrollRangeIntoView(range) {
    const target = range instanceof Element ? range : range?.startContainer?.parentElement;
    if (!target) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'center', inline: 'nearest' });
        });
    });
}

export function applySearchHighlights(searchTerm, { scrollToFirst = false } = {}) {
    const registry = getHighlightRegistry();
    clearSearchHighlights();

    const editor = document.getElementById('noteContent');
    const ranges = findTextMatches(editor, searchTerm);
    if (!ranges.length) return 0;

    if (registry && typeof globalThis.Highlight === 'function') {
        registry.set(SEARCH_HIGHLIGHT_NAME, new Highlight(...ranges));
        if (scrollToFirst) scrollRangeIntoView(ranges[0]);
        return ranges.length;
    }

    [...ranges].reverse().forEach((range) => {
        const mark = document.createElement('mark');
        mark.setAttribute(SEARCH_HIGHLIGHT_ATTRIBUTE, '');
        range.surroundContents(mark);
    });
    if (scrollToFirst) {
        scrollRangeIntoView(editor.querySelector(`mark[${SEARCH_HIGHLIGHT_ATTRIBUTE}]`));
    }
    return ranges.length;
}

export function getEditorHtmlWithoutSearchHighlights(editor) {
    if (!editor) return '';

    const clone = editor.cloneNode(true);
    clone.querySelectorAll(`mark[${SEARCH_HIGHLIGHT_ATTRIBUTE}]`).forEach((mark) => {
        mark.replaceWith(...mark.childNodes);
    });
    return clone.innerHTML;
}
