import { convertMarkdownToHtml, hasMeaningfulHtmlContent, looksLikeMarkdown } from './markdown-import.js';

const ALLOWED_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4',
    'p', 'b', 'i', 'strong', 'em', 'u',
    'li', 'ol', 'ul',
    'blockquote', 'hr',
    'pre', 'code',
    'table', 'thead', 'tbody', 'th', 'tr', 'td',
    'div',
    'a'
]);

const FORBIDDEN_TAGS = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
    'form', 'input', 'button', 'textarea', 'select', 'option',
    'svg', 'math'
]);

const ALLOWED_ATTRS_BY_TAG = {
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
    tr: new Set([]),
    table: new Set([]),
    thead: new Set([]),
    tbody: new Set([]),
    div: new Set([]),
    p: new Set([]),
    h1: new Set([]),
    h2: new Set([]),
    h3: new Set([]),
    h4: new Set([]),
    b: new Set([]),
    i: new Set([]),
    strong: new Set([]),
    em: new Set([]),
    u: new Set([]),
    ol: new Set([]),
    ul: new Set([]),
    li: new Set([]),
    blockquote: new Set([]),
    hr: new Set([]),
    pre: new Set([]),
    code: new Set(['class']),
    a: new Set(['href'])
};

let showPasteChoiceDialog = null;

export function initSmartPaste(deps) {
    showPasteChoiceDialog = deps.showPasteChoiceDialog;
}

function isSafeHref(value) {
    const href = String(value || '').trim();
    if (!href) return false;
    if (href[0] === '#' || href[0] === '/') return true;
    return /^(https?:|mailto:|tel:)/i.test(href);
}

export function sanitizeHtmlForPaste(html) {
    if (typeof html !== 'string' || html.trim() === '') return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__notes_root__">${html}</div>`, 'text/html');
    const root = doc.getElementById('__notes_root__');
    if (!root) return '';

    const sanitizeNode = (node) => {
        if (!node) return;

        if (node.nodeType === Node.COMMENT_NODE) {
            node.parentNode?.removeChild(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName.toLowerCase();

        if (FORBIDDEN_TAGS.has(tag)) {
            node.parentNode?.removeChild(node);
            return;
        }

        if (!ALLOWED_TAGS.has(tag)) {
            const parent = node.parentNode;
            if (parent) {
                while (node.firstChild) {
                    parent.insertBefore(node.firstChild, node);
                }
                parent.removeChild(node);
            }
            return;
        }

        const allowedAttrs = ALLOWED_ATTRS_BY_TAG[tag] || new Set();
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name.toLowerCase();

            if (name.startsWith('on') || name === 'style') {
                node.removeAttribute(attr.name);
                continue;
            }

            if (!allowedAttrs.has(name)) {
                node.removeAttribute(attr.name);
                continue;
            }

            if (tag === 'a' && name === 'href' && !isSafeHref(attr.value)) {
                node.removeAttribute(attr.name);
                continue;
            }

            if (tag === 'code' && name === 'class') {
                const classes = String(attr.value || '')
                    .trim()
                    .split(/\s+/)
                    .filter((className) => /^language-[a-z0-9_-]+$/i.test(className));
                if (!classes.length) {
                    node.removeAttribute(attr.name);
                } else {
                    node.setAttribute(attr.name, classes.join(' '));
                }
                continue;
            }

            if (name === 'colspan' || name === 'rowspan') {
                const normalized = String(attr.value || '').replace(/[^0-9]/g, '');
                if (!normalized) {
                    node.removeAttribute(attr.name);
                } else {
                    node.setAttribute(attr.name, normalized);
                }
            }
        }

        for (const child of Array.from(node.childNodes)) {
            sanitizeNode(child);
        }
    };

    for (const child of Array.from(root.childNodes)) {
        sanitizeNode(child);
    }

    return root.innerHTML;
}

function getHtmlFormattingSignals(html) {
    const input = String(html || '').trim();
    if (!input) {
        return { hasSemanticFormatting: false, hasBlockStructure: false };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__notes_fmt_root__">${input}</div>`, 'text/html');
    const root = doc.getElementById('__notes_fmt_root__');
    if (!root) {
        return { hasSemanticFormatting: false, hasBlockStructure: false };
    }

    const meaningfulTags = [
        'h1', 'h2', 'h3', 'h4',
        'b', 'i', 'strong', 'em', 'u',
        'li', 'ol', 'ul',
        'blockquote', 'hr',
        'pre', 'code',
        'table', 'thead', 'tbody', 'th', 'tr', 'td',
        'a'
    ];

    const hasSemanticFormatting = meaningfulTags.some((tag) => root.querySelector(tag));
    const hasBlockStructure = root.querySelectorAll('p, div, br').length > 1;

    return { hasSemanticFormatting, hasBlockStructure };
}

function normalizeEditorHtmlAfterInsert(editor) {
    if (!editor) return;

    const markerId = `notes-paste-caret-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        const marker = document.createElement('span');
        marker.setAttribute('data-notes-paste-caret', markerId);
        range.insertNode(marker);
    }

    editor.innerHTML = editor.innerHTML;

    const marker = editor.querySelector(`[data-notes-paste-caret="${markerId}"]`);
    if (marker) {
        const restoreRange = document.createRange();
        restoreRange.setStartAfter(marker);
        restoreRange.collapse(true);
        marker.remove();

        const updatedSelection = window.getSelection();
        if (updatedSelection) {
            updatedSelection.removeAllRanges();
            updatedSelection.addRange(restoreRange);
        }
    }
}

function insertHtmlAtSelection(html) {
    const sanitizedHtml = String(html || '');
    if (!sanitizedHtml) return false;

    const editor = document.getElementById('noteContent');

    try {
        const inserted = document.execCommand('insertHTML', false, sanitizedHtml);
        if (inserted) {
            normalizeEditorHtmlAfterInsert(editor);
            return true;
        }
    } catch {
        // Fall through to Range-based insertion.
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = range.createContextualFragment(sanitizedHtml);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);

    if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    normalizeEditorHtmlAfterInsert(editor);

    return true;
}

function insertPlainTextAtSelection(text) {
    try {
        const inserted = document.execCommand('insertText', false, text);
        if (inserted) return true;
    } catch {
        // Fall through to Range-based insertion.
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

export async function handleSmartPaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return false;

    const html = clipboard.getData('text/html') || '';
    const text = clipboard.getData('text/plain') || '';
    const textLooksLikeMarkdown = looksLikeMarkdown(text);

    if (html.trim()) {
        const sanitizedHtml = sanitizeHtmlForPaste(html);
        const { hasSemanticFormatting, hasBlockStructure } = getHtmlFormattingSignals(sanitizedHtml);
        const htmlLooksFormatted = hasSemanticFormatting || (hasBlockStructure && !textLooksLikeMarkdown);

        if (htmlLooksFormatted && sanitizedHtml.trim()) {
            event.preventDefault();
            return insertHtmlAtSelection(sanitizedHtml);
        }

        if (text) {
            event.preventDefault();
            if (!textLooksLikeMarkdown) {
                return insertPlainTextAtSelection(text);
            }
        }
    }

    if (!text) return false;
    if (!textLooksLikeMarkdown) {
        event.preventDefault();
        return insertPlainTextAtSelection(text);
    }

    event.preventDefault();
    const choice = showPasteChoiceDialog
        ? await showPasteChoiceDialog()
        : 'markdown';

    if (choice === 'cancel') return false;
    if (choice === 'plain_text') {
        return insertPlainTextAtSelection(text);
    }

    const htmlFromMarkdown = convertMarkdownToHtml(text);
    const sanitizedHtml = sanitizeHtmlForPaste(htmlFromMarkdown);
    if (!sanitizedHtml.trim() && !hasMeaningfulHtmlContent(htmlFromMarkdown)) {
        return false;
    }
    if (!sanitizedHtml.trim()) {
        return false;
    }
    return insertHtmlAtSelection(sanitizedHtml);
}
