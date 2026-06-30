// Editor HTML management and HTML mode handling
import state from './state.js';

const INLINE_TAGS = new Set([
    'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em',
    'i', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub',
    'sup', 'time', 'u', 'var', 'wbr'
]);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT_TAGS = new Set(['pre', 'code']);

export function getEditorHtml() {
    if (state.isHtmlMode) {
        // IMPORTANT: return the canonical (unformatted) HTML string.
        // The textarea may contain a pretty-printed display version.
        if (typeof state.htmlModeRawHtml === 'string') return state.htmlModeRawHtml;
        const htmlEl = document.getElementById('noteContentHtml');
        return htmlEl ? htmlEl.value : '';
    }
    const editor = document.getElementById('noteContent');
    return editor ? editor.innerHTML : '';
}

export function formatHtmlForDisplay(html) {
    const input = String(html ?? '');
    try {
        const template = document.createElement('template');
        template.innerHTML = input;
        return serializeNodesForDisplay(Array.from(template.content.childNodes)).trim();
    } catch { /* ignore */ }
    return input;
}

function serializeNodesForDisplay(nodes, depth = 0, parentTag = '') {
    return nodes
        .map((node) => serializeNodeForDisplay(node, depth, parentTag))
        .filter(Boolean)
        .join('\n');
}

function serializeNodeForDisplay(node, depth = 0, parentTag = '') {
    if (node.nodeType === Node.TEXT_NODE) {
        const value = node.textContent || '';
        if (RAW_TEXT_TAGS.has(parentTag)) return indentRawText(value, depth);
        const collapsed = value.replace(/\s+/g, ' ').trim();
        return collapsed ? `${'  '.repeat(depth)}${collapsed}` : '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const attrs = Array.from(node.attributes)
        .map((attr) => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
        .join(' ');
    const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
    const indent = '  '.repeat(depth);

    if (VOID_TAGS.has(tag)) {
        return `${indent}${openTag}`;
    }

    if (RAW_TEXT_TAGS.has(tag)) {
        const rawText = node.textContent || '';
        const indentedRaw = indentRawText(rawText, depth + 1);
        return `${indent}${openTag}\n${indentedRaw}\n${indent}</${tag}>`;
    }

    const children = Array.from(node.childNodes);
    if (!children.length) {
        return `${indent}${openTag}</${tag}>`;
    }

    const inlineOnly = children.every((child) => isInlineDisplayNode(child, tag));
    if (inlineOnly) {
        const inlineContent = children.map((child) => serializeInlineNode(child)).join('').trim();
        return `${indent}${openTag}${inlineContent}</${tag}>`;
    }

    const childContent = children
        .map((child) => serializeNodeForDisplay(child, depth + 1, tag))
        .filter(Boolean)
        .join('\n');
    return `${indent}${openTag}\n${childContent}\n${indent}</${tag}>`;
}

function serializeInlineNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || '').replace(/\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const attrs = Array.from(node.attributes)
        .map((attr) => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
        .join(' ');
    const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

    if (VOID_TAGS.has(tag)) return openTag;
    if (RAW_TEXT_TAGS.has(tag)) return `${openTag}${node.textContent || ''}</${tag}>`;

    const content = Array.from(node.childNodes).map((child) => serializeInlineNode(child)).join('');
    return `${openTag}${content}</${tag}>`;
}

function isInlineDisplayNode(node, parentTag) {
    if (node.nodeType === Node.TEXT_NODE) {
        return !RAW_TEXT_TAGS.has(parentTag);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    return INLINE_TAGS.has(node.tagName.toLowerCase());
}

function indentRawText(text, depth) {
    const indent = '  '.repeat(depth);
    return String(text)
        .split('\n')
        .map((line) => `${indent}${line}`)
        .join('\n');
}

export function formatHtmlModeTextarea() {
    const htmlEl = document.getElementById('noteContentHtml');
    if (!htmlEl) return;

    const formatted = formatHtmlForDisplay(htmlEl.value);
    htmlEl.value = formatted;
    state.htmlModeRawHtml = formatted;
    state.htmlModeDirty = true;
}

function updateHtmlModeToolbar(isHtmlModeActive) {
    const richTextGroup = document.querySelector('.toolbar-group[aria-label="Inline formatting"]');
    const structureGroup = document.querySelector('.toolbar-group[aria-label="Structure and insertion"]');
    const headingGroup = document.querySelector('.toolbar-group.desktop-only[aria-label="Headings and code"]');
    const dateBtn = document.getElementById('insertDateBtn');
    const checkBtn = document.getElementById('insertCheckmarkBtn');

    [richTextGroup, structureGroup, headingGroup, dateBtn, checkBtn].forEach((el) => {
        if (!el) return;
        el.hidden = !!isHtmlModeActive;
    });
}

// Empty editor content: use a single <p> so Enter and block behavior work (contenteditable needs a block).
const EMPTY_EDITOR_HTML = '<p><br></p>';

export function setEditorHtml(html) {
    const editor = document.getElementById('noteContent');
    const htmlEl = document.getElementById('noteContentHtml');
    const raw = String(html ?? '').trim();
    state.htmlModeRawHtml = raw === '' ? EMPTY_EDITOR_HTML : raw;
    state.htmlModeDirty = false;

    if (editor) editor.innerHTML = state.htmlModeRawHtml;
    if (htmlEl) {
        htmlEl.value = state.isHtmlMode ? formatHtmlForDisplay(state.htmlModeRawHtml) : state.htmlModeRawHtml;
    }
}

export function setHtmlMode(enabled) {
    state.isHtmlMode = !!enabled;
    const editor = document.getElementById('noteContent');
    const htmlEl = document.getElementById('noteContentHtml');
    const btn = document.getElementById('htmlModeBtn');
    const formatBtn = document.getElementById('formatHtmlBtn');
    const btnMobile = document.getElementById('htmlModeBtnMobile');
    if (!editor || !htmlEl || !btn) return;

    if (state.isHtmlMode) {
        state.htmlModeDirty = false;
        state.htmlModeRawHtml = editor.innerHTML;
        htmlEl.value = formatHtmlForDisplay(state.htmlModeRawHtml);
        htmlEl.hidden = false;
        editor.hidden = true;
        updateHtmlModeToolbar(true);
        btn.classList.add('active');
        if (formatBtn) formatBtn.hidden = false;
        if (btnMobile) btnMobile.classList.add('active');
        htmlEl.focus();
    } else {
        // If the user edited the textarea, `htmlModeRawHtml` is updated on input.
        // If they did not, keep the original raw HTML (not the formatted display string).
        editor.innerHTML = state.htmlModeRawHtml;
        editor.hidden = false;
        htmlEl.hidden = true;
        updateHtmlModeToolbar(false);
        btn.classList.remove('active');
        if (formatBtn) formatBtn.hidden = true;
        if (btnMobile) btnMobile.classList.remove('active');
        editor.focus();
    }
}
