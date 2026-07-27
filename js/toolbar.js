// Formatting toolbar setup and state management
import { escapeHtml, isMobileLayout } from './utils.js';
import { isHtmlMode } from './state.js';
import { handleSmartPaste } from './smart-paste.js';

// These will be imported from other modules
let trackChanges = null;
let showLinkDialog = null;
let insertDate = null;
let insertCheckmark = null;
let lastEditorRange = null;

// Initialize with dependencies
export function initToolbar(deps) {
    trackChanges = deps.trackChanges;
    showLinkDialog = deps.showLinkDialog;
    insertDate = deps.insertDate;
    insertCheckmark = deps.insertCheckmark;
}

export function getTextNodeAndOffsetAtCaret(range) {
    const container = range.startContainer;
    const offset = range.startOffset;

    // Common case: caret is inside a text node
    if (container && container.nodeType === Node.TEXT_NODE) {
        return { node: container, offset };
    }

    // Fallback: caret is in an element node, try to find a nearby text node
    if (!container || container.nodeType !== Node.ELEMENT_NODE) {
        return { node: null, offset: 0 };
    }

    // Try text node immediately before the caret position
    const childBefore = offset > 0 ? container.childNodes[offset - 1] : null;
    if (childBefore) {
        const lastText = findLastTextNode(childBefore);
        if (lastText) return { node: lastText, offset: lastText.data.length };
    }

    return { node: null, offset: 0 };
}

function deleteTextBeforeCaret(count) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || count <= 0) return false;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return false;

    const { node, offset } = getTextNodeAndOffsetAtCaret(range);
    if (!node || offset < count) return false;

    const deleteRange = document.createRange();
    deleteRange.setStart(node, offset - count);
    deleteRange.setEnd(node, offset);
    deleteRange.deleteContents();

    const newRange = document.createRange();
    newRange.setStart(node, offset - count);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    return true;
}

function findLastTextNode(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) return node;
    // Walk backwards through descendants
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const found = findLastTextNode(node.childNodes[i]);
        if (found) return found;
    }
    return null;
}

function replaceMobileDoubleSpace(editor, event) {
    if (isHtmlMode() || !isMobileLayout() || event.inputType !== 'insertText' || event.data !== ' ' || event.isComposing) {
        return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.startContainer)) return false;

    const { node, offset } = getTextNodeAndOffsetAtCaret(range);
    if (!node || offset < 1 || !/[ \u00a0]/.test(node.data[offset - 1])) return false;

    const parent = node.parentElement;
    if (parent && parent.closest('pre, code')) return false;

    event.preventDefault();

    const replacementRange = document.createRange();
    replacementRange.setStart(node, offset - 1);
    replacementRange.setEnd(node, offset);
    selection.removeAllRanges();
    selection.addRange(replacementRange);

    let replaced = false;
    try {
        replaced = document.execCommand('insertText', false, '. ');
    } catch {
        replaced = false;
    }

    if (!replaced) {
        replacementRange.deleteContents();
        const replacement = document.createTextNode('. ');
        replacementRange.insertNode(replacement);
        replacementRange.setStartAfter(replacement);
        replacementRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(replacementRange);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    saveEditorSelection();
    updateToolbarState();
    if (trackChanges) trackChanges();

    return true;
}

const BLOCK_TAG_NAMES = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'PRE', 'LI', 'BLOCKQUOTE', 'TD', 'TH']);
const EMPTY_EDITOR_HTML = '<p><br></p>';
const MAX_INDENT_LEVEL = 4;

function getBlockElement(container, editorRoot) {
    let node = container && container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    while (node && node !== editorRoot) {
        if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAG_NAMES.has(node.tagName)) {
            return node;
        }
        node = node.parentElement;
    }
    return node || editorRoot;
}

function resetEditorFormattingIfEmpty(editor) {
    if (!editor) return false;

    const text = (editor.textContent || '').replace(/\u200B/g, '').trim();
    if (text !== '') return false;

    editor.innerHTML = EMPTY_EDITOR_HTML;

    const selection = window.getSelection();
    const range = document.createRange();
    const target = editor.querySelector('p') || editor;
    range.selectNodeContents(target);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    return true;
}

function removeInlineTypingMarkers(editor) {
    if (!editor || !(editor.textContent || '').includes('\u200B')) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const caretNode = range && range.collapsed ? range.startContainer : null;
    const caretOffset = range && range.collapsed ? range.startOffset : 0;
    let nextCaretOffset = caretOffset;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
        if (!node.data.includes('\u200B')) return;
        if (node === caretNode) {
            const markersBeforeCaret = (node.data.slice(0, caretOffset).match(/\u200B/g) || []).length;
            nextCaretOffset = Math.max(0, caretOffset - markersBeforeCaret);
        }
        node.data = node.data.replace(/\u200B/g, '');
    });

    if (caretNode && editor.contains(caretNode)) {
        const nextRange = document.createRange();
        nextRange.setStart(caretNode, Math.min(nextCaretOffset, caretNode.data.length));
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
    }
}

function getSelectionElement() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (!container) return null;

    return container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
}

function getIndentTarget(editor) {
    const element = getSelectionElement();
    if (!element || !editor) return null;

    const block = getBlockElement(element, editor);
    if (!block || block === editor) return null;

    return block;
}

function getIndentLevel(element) {
    if (!element || !element.classList) return 0;
    for (let level = MAX_INDENT_LEVEL; level >= 1; level--) {
        if (element.classList.contains(`indent-${level}`)) {
            return level;
        }
    }
    return 0;
}

function setIndentLevel(element, level) {
    if (!element || !element.classList) return;
    for (let current = 1; current <= MAX_INDENT_LEVEL; current++) {
        element.classList.remove(`indent-${current}`);
    }
    if (level > 0) {
        element.classList.add(`indent-${level}`);
    }
}

function setButtonEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function getEditorElement() {
    return document.getElementById('noteContent');
}

function focusWithoutScroll(element) {
    if (!element || typeof element.focus !== 'function') return;
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
}

function getScrollSnapshot() {
    const scrollingElement = document.scrollingElement || document.documentElement;
    return {
        windowX: window.scrollX,
        windowY: window.scrollY,
        documentTop: scrollingElement ? scrollingElement.scrollTop : 0,
        documentLeft: scrollingElement ? scrollingElement.scrollLeft : 0
    };
}

function restoreScrollSnapshot(snapshot) {
    if (!snapshot) return;
    const scrollingElement = document.scrollingElement || document.documentElement;
    if (scrollingElement) {
        scrollingElement.scrollTop = snapshot.documentTop;
        scrollingElement.scrollLeft = snapshot.documentLeft;
    }
    window.scrollTo(snapshot.windowX, snapshot.windowY);
}

function saveEditorSelection() {
    const editor = getEditorElement();
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    if (!commonAncestor) return;

    const isInsideEditor = commonAncestor === editor
        || (commonAncestor.nodeType === Node.ELEMENT_NODE && editor.contains(commonAncestor))
        || (commonAncestor.nodeType === Node.TEXT_NODE && editor.contains(commonAncestor.parentNode));

    if (!isInsideEditor) return;
    lastEditorRange = range.cloneRange();
}

function restoreEditorSelection() {
    const editor = getEditorElement();
    if (!editor || !lastEditorRange) return false;

    const commonAncestor = lastEditorRange.commonAncestorContainer;
    const isInsideEditor = commonAncestor === editor
        || (commonAncestor.nodeType === Node.ELEMENT_NODE && editor.contains(commonAncestor))
        || (commonAncestor.nodeType === Node.TEXT_NODE && editor.contains(commonAncestor.parentNode));
    if (!isInsideEditor) return false;

    const scrollSnapshot = getScrollSnapshot();
    focusWithoutScroll(editor);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(lastEditorRange.cloneRange());
    restoreScrollSnapshot(scrollSnapshot);
    return true;
}

function ensureEditorSelection() {
    if (restoreEditorSelection()) return true;

    const editor = getEditorElement();
    const selection = window.getSelection();
    if (!editor || !selection) return false;

    const scrollSnapshot = getScrollSnapshot();
    focusWithoutScroll(editor);

    const range = document.createRange();
    const target = editor.querySelector('p') || editor;
    range.selectNodeContents(target);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    lastEditorRange = range.cloneRange();

    restoreScrollSnapshot(scrollSnapshot);
    return true;
}

export function updateToolbarState() {
    const editor = getEditorElement();
    if (!editor) return;

    const selection = window.getSelection();
    const anchorNode = selection && selection.anchorNode ? selection.anchorNode : null;
    const isInEditor = document.activeElement === editor || (anchorNode && editor.contains(anchorNode));
    if (isInEditor) saveEditorSelection();
    if (!isInEditor) return;

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');
    const underlineBtnMobile = document.getElementById('underlineBtnMobile');
    const bulletListBtn = document.getElementById('bulletListBtn');
    const bulletListBtnMobile = document.getElementById('bulletListBtnMobile');
    const numberedListBtn = document.getElementById('numberedListBtn');
    const outdentBtn = document.getElementById('outdentBtn');
    const indentBtn = document.getElementById('indentBtn');
    const h1Btn = document.getElementById('h1Btn');
    const h2Btn = document.getElementById('h2Btn');
    const h3Btn = document.getElementById('h3Btn');
    const preBtn = document.getElementById('preBtn');
    const outdentBtnMobile = document.getElementById('outdentBtnMobile');
    const indentBtnMobile = document.getElementById('indentBtnMobile');
    const h1BtnMobile = document.getElementById('h1BtnMobile');
    const h2BtnMobile = document.getElementById('h2BtnMobile');
    const h3BtnMobile = document.getElementById('h3BtnMobile');
    const preBtnMobile = document.getElementById('preBtnMobile');

    const setPressed = (btn, pressed) => {
        if (!btn) return;
        btn.classList.toggle('active', !!pressed);
        // Helps screen readers; also matches the "toggle" mental model.
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    };

    setPressed(boldBtn, document.queryCommandState('bold'));
    setPressed(italicBtn, document.queryCommandState('italic'));
    setPressed(underlineBtn, document.queryCommandState('underline'));
    setPressed(underlineBtnMobile, document.queryCommandState('underline'));

    const isEditorEmpty = (editor.textContent || '').replace(/\u200B/g, '').trim() === '';
    if (isEditorEmpty) {
        setPressed(bulletListBtn, false);
        setPressed(bulletListBtnMobile, false);
        setPressed(numberedListBtn, false);
        setPressed(h1Btn, false);
        setPressed(h2Btn, false);
        setPressed(h3Btn, false);
        setPressed(preBtn, false);
        setPressed(h1BtnMobile, false);
        setPressed(h2BtnMobile, false);
        setPressed(h3BtnMobile, false);
        setPressed(preBtnMobile, false);
        return;
    }

    setPressed(bulletListBtn, document.queryCommandState('insertUnorderedList'));
    setPressed(bulletListBtnMobile, document.queryCommandState('insertUnorderedList'));
    setPressed(numberedListBtn, document.queryCommandState('insertOrderedList'));

    const indentTarget = getIndentTarget(editor);
    const indentLevel = getIndentLevel(indentTarget);
    setButtonEnabled(outdentBtn, !!indentTarget && indentLevel > 0);
    setButtonEnabled(indentBtn, !!indentTarget && indentLevel < MAX_INDENT_LEVEL);
    setButtonEnabled(outdentBtnMobile, !!indentTarget && indentLevel > 0);
    setButtonEnabled(indentBtnMobile, !!indentTarget && indentLevel < MAX_INDENT_LEVEL);

    let block = '';
    try {
        block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch {
        block = '';
    }
    // Browsers vary: sometimes it's "h1", sometimes "<h1>"
    block = block.replace(/[<>]/g, '');

    const isH1 = block === 'h1';
    const isH2 = block === 'h2';
    const isH3 = block === 'h3';
    const isPre = block === 'pre';

    setPressed(h1Btn, isH1);
    setPressed(h2Btn, isH2);
    setPressed(h3Btn, isH3);
    setPressed(preBtn, isPre);
    setPressed(h1BtnMobile, isH1);
    setPressed(h2BtnMobile, isH2);
    setPressed(h3BtnMobile, isH3);
    setPressed(preBtnMobile, isPre);
}

export function setupFormattingToolbar() {
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const primaryModifier = /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl+';
    [
        ['boldBtn', 'Bold', 'B'],
        ['italicBtn', 'Italic', 'I'],
        ['underlineBtn', 'Underline', 'U']
    ].forEach(([id, label, key]) => {
        const button = document.getElementById(id);
        if (button) button.title = `${label} (${primaryModifier}${key})`;
    });

    const bindClickIfExists = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            ensureEditorSelection();
        });
        el.addEventListener('click', handler);
    };

    const focusEditorAndSync = () => {
        const editor = getEditorElement();
        if (editor && document.activeElement !== editor) focusWithoutScroll(editor);
        saveEditorSelection();
        updateToolbarState();
        if (trackChanges) trackChanges();
    };

    const toggleInlineFormat = (command, tagName) => {
        const editor = getEditorElement();
        if (!editor) return;

        const isEditorEmpty = (editor.textContent || '').replace(/\u200B/g, '').trim() === '';
        if (!isEditorEmpty) {
            document.execCommand(command, false, null);
            focusEditorAndSync();
            return;
        }

        if (document.queryCommandState(command)) {
            resetEditorFormattingIfEmpty(editor);
        } else {
            const block = document.createElement('p');
            const inline = document.createElement(tagName);
            const marker = document.createTextNode('\u200B');
            inline.appendChild(marker);
            block.appendChild(inline);
            editor.replaceChildren(block);

            const selection = window.getSelection();
            const range = document.createRange();
            range.setStart(marker, marker.data.length);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }

        saveEditorSelection();
        focusEditorAndSync();
    };

    const adjustBlockIndentation = (delta) => {
        const editor = document.getElementById('noteContent');
        const target = getIndentTarget(editor);
        if (!target) return false;

        const currentLevel = getIndentLevel(target);
        const nextLevel = Math.max(0, Math.min(MAX_INDENT_LEVEL, currentLevel + delta));
        if (nextLevel === currentLevel) return false;

        setIndentLevel(target, nextLevel);
        focusEditorAndSync();
        return true;
    };

    bindClickIfExists('boldBtn', () => {
        toggleInlineFormat('bold', 'strong');
    });
    
    bindClickIfExists('italicBtn', () => {
        toggleInlineFormat('italic', 'em');
    });
    
    bindClickIfExists('underlineBtn', () => {
        toggleInlineFormat('underline', 'u');
    });
    
    document.getElementById('bulletListBtn').addEventListener('click', () => {
        document.execCommand('insertUnorderedList', false, null);
        focusEditorAndSync();
    });
    
    document.getElementById('numberedListBtn').addEventListener('click', () => {
        document.execCommand('insertOrderedList', false, null);
        focusEditorAndSync();
    });

    bindClickIfExists('outdentBtn', () => {
        adjustBlockIndentation(-1);
    });

    bindClickIfExists('indentBtn', () => {
        adjustBlockIndentation(1);
    });
    
    bindClickIfExists('horizontalRuleBtn', () => {
        document.execCommand('insertHorizontalRule', false, null);
        focusEditorAndSync();
    });
    
    const insertLink = async () => {
        const selection = window.getSelection();
        
        // Check if selection is inside a link (even if collapsed)
        let existingLink = null;
        let selectedText = '';
        let savedRange = null;
        let existingUrl = '';
        let existingTitle = '';
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            savedRange = range.cloneRange();
            
            // Check if anchor node is inside a link
            const anchorNode = selection.anchorNode;
            if (anchorNode) {
                // Find the closest link element
                const node = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
                existingLink = node.closest ? node.closest('a') : null;
                
                if (existingLink) {
                    // Extract existing link data
                    existingUrl = existingLink.href || existingLink.getAttribute('href') || '';
                    existingTitle = existingLink.textContent || existingLink.innerText || '';
                    selectedText = existingTitle;
                } else if (!selection.isCollapsed) {
                    // Text is selected but not inside a link
                    selectedText = range.toString();
                }
            }
        }
        
        // Show dialog with existing link data if available
        const result = await showLinkDialog(selectedText, existingUrl);
        
        if (!result || !result.url || !result.url.trim()) {
            return; // User cancelled or didn't provide URL
        }
        
        const title = result.title && result.title.trim() ? result.title.trim() : result.url.trim();
        const url = result.url.trim();
        
        // If we're editing an existing link, replace it
        if (existingLink) {
            // Select the entire link element (not just contents)
            const linkRange = document.createRange();
            linkRange.selectNode(existingLink);
            selection.removeAllRanges();
            selection.addRange(linkRange);
            // Replace with new link
            document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`);
        } else if (savedRange) {
            // Restore selection and replace selected text with link
            selection.removeAllRanges();
            selection.addRange(savedRange);
            document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`);
        } else {
            // Insert new link
            document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`);
        }
        
        focusEditorAndSync();
    };
    
    bindClickIfExists('linkBtn', insertLink);

    const getCurrentBlockTag = () => {
        try {
            return String(document.queryCommandValue('formatBlock') || '')
                .toLowerCase()
                .replace(/[<>]/g, '');
        } catch {
            return '';
        }
    };

    const applyBlock = (tag, toggle = false) => {
        const nextTag = toggle && getCurrentBlockTag() === tag ? 'p' : tag;
        document.execCommand('formatBlock', false, nextTag);
        focusEditorAndSync();
    };

    const applyInlineShortcut = (key) => {
        if (!deleteTextBeforeCaret(2)) return false;

        if (key === '0') {
            clearFormatting();
        } else if (key === 'p') {
            applyBlock('p');
        } else if (key === '1') {
            applyBlock('h1');
        } else if (key === '2') {
            applyBlock('h2');
        } else if (key === '3') {
            applyBlock('h3');
        } else if (key === 'b') {
            document.execCommand('insertUnorderedList', false, null);
            focusEditorAndSync();
        } else if (key === 'n') {
            document.execCommand('insertOrderedList', false, null);
            focusEditorAndSync();
        } else if (key === 'c') {
            togglePre();
        } else if (key === 'd') {
            if (insertDate) insertDate();
        } else if (key === 'v') {
            if (insertCheckmark) insertCheckmark();
        } else {
            return false;
        }

        if (trackChanges) trackChanges();
        return true;
    };

    const clearFormatting = () => {
        // Remove inline formatting such as bold, italic, underline, links, etc.
        try {
            document.execCommand('removeFormat', false, null);
        } catch {
            // ignore
        }

        // Reset block type back to a normal paragraph (removes H1/H2/H3/pre wrappers)
        try {
            document.execCommand('formatBlock', false, 'p');
        } catch {
            // ignore
        }

        // If a list is active, toggle it off so list styling is cleared as well.
        try {
            if (document.queryCommandState('insertUnorderedList')) {
                document.execCommand('insertUnorderedList', false, null);
            }
            if (document.queryCommandState('insertOrderedList')) {
                document.execCommand('insertOrderedList', false, null);
            }
        } catch {
            // ignore
        }

        focusEditorAndSync();
    };

    const togglePre = () => {
        // Toggle: if we're already in <pre>, switch back to normal paragraph
        let currentBlock = '';
        try {
            currentBlock = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
        } catch {
            currentBlock = '';
        }
        currentBlock = currentBlock.replace(/[<>]/g, '');
        document.execCommand('formatBlock', false, currentBlock === 'pre' ? 'p' : 'pre');
        focusEditorAndSync();
    };

    const closeParentDetails = (fromEl) => {
        if (!fromEl || typeof fromEl.closest !== 'function') return;
        const details = fromEl.closest('details');
        if (details && details.hasAttribute('open')) {
            details.removeAttribute('open');
        }
    };

    bindClickIfExists('h1Btn', () => applyBlock('h1', true));
    bindClickIfExists('h2Btn', () => applyBlock('h2', true));
    bindClickIfExists('h3Btn', () => applyBlock('h3', true));
    bindClickIfExists('clearFormatBtn', () => clearFormatting());
    bindClickIfExists('preBtn', togglePre);

    // Mobile overflow menu buttons (same actions)
    bindClickIfExists('h1BtnMobile', (e) => {
        applyBlock('h1', true);
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('h2BtnMobile', (e) => {
        applyBlock('h2', true);
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('h3BtnMobile', (e) => {
        applyBlock('h3', true);
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('clearFormatBtnMobile', (e) => {
        clearFormatting();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('preBtnMobile', (e) => {
        togglePre();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('outdentBtnMobile', (e) => {
        adjustBlockIndentation(-1);
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('indentBtnMobile', (e) => {
        adjustBlockIndentation(1);
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('bulletListBtnMobile', (e) => {
        document.execCommand('insertUnorderedList', false, null);
        focusEditorAndSync();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('underlineBtnMobile', (e) => {
        document.execCommand('underline', false, null);
        focusEditorAndSync();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('horizontalRuleBtnMobile', (e) => {
        document.execCommand('insertHorizontalRule', false, null);
        focusEditorAndSync();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('linkBtnMobile', (e) => {
        insertLink();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('insertDateBtnMobile', (e) => {
        if (insertDate) insertDate();
        focusEditorAndSync();
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('insertCheckmarkBtnMobile', (e) => {
        if (insertCheckmark) insertCheckmark();
        focusEditorAndSync();
        closeParentDetails(e.currentTarget);
    });
    
    document.getElementById('insertDateBtn').addEventListener('click', () => {
        restoreEditorSelection();
        if (insertDate) insertDate();
        if (trackChanges) trackChanges();
    });
    
    document.getElementById('insertCheckmarkBtn').addEventListener('click', () => {
        restoreEditorSelection();
        if (insertCheckmark) insertCheckmark();
        if (trackChanges) trackChanges();
    });
    
    const noteContent = document.getElementById('noteContent');

    // On mobile, turn a second typed space into the conventional full stop + space.
    // `beforeinput` also covers on-screen keyboards, unlike keydown alone.
    noteContent.addEventListener('beforeinput', (e) => {
        replaceMobileDoubleSpace(noteContent, e);
    });

    // Keyboard shortcuts
    noteContent.addEventListener('keydown', (e) => {
        // Only apply custom shortcuts in visual mode (not HTML source mode).
        if (typeof isHtmlMode === 'function' && isHtmlMode()) {
            return;
        }

        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (getIndentTarget(document.getElementById('noteContent'))) {
                e.preventDefault();
                adjustBlockIndentation(e.shiftKey ? -1 : 1);
                return;
            }
        }

        // Shift+Enter inside lists: insert a line break within the current <li>.
        if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.startContainer;
                const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
                const li = element && typeof element.closest === 'function' ? element.closest('li') : null;

                if (li) {
                    e.preventDefault();

                    let inserted = false;
                    try {
                        inserted = document.execCommand('insertLineBreak', false, null);
                    } catch {
                        inserted = false;
                    }

                    if (!inserted) {
                        const br = document.createElement('br');
                        // Replace any selected content with the line break
                        range.deleteContents();
                        range.insertNode(br);
                        // Move caret just after the <br> we inserted
                        range.setStartAfter(br);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }

                    // Sync toolbar state and change tracking after the edit.
                    setTimeout(updateToolbarState, 0);
                    if (trackChanges) setTimeout(trackChanges, 0);
                    return;
                }
            }
        }

        // Plain Enter: inside <pre> insert newline; otherwise force new block to be <p> (browser often creates <div>).
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const selection = window.getSelection();
            const editor = document.getElementById('noteContent');
            if (selection && selection.rangeCount > 0 && editor) {
                const range = selection.getRangeAt(0);
                const container = range.startContainer;
                const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
                const insideLi = element && typeof element.closest === 'function' && element.closest('li');
                if (insideLi) {
                    // Let browser create new list item.
                    return;
                }
                const insidePre = element && typeof element.closest === 'function' && element.closest('pre');
                if (insidePre) {
                    e.preventDefault();
                    let inserted = false;
                    try {
                        inserted = document.execCommand('insertLineBreak', false, null);
                    } catch {
                        inserted = false;
                    }
                    if (!inserted) {
                        const br = document.createElement('br');
                        range.deleteContents();
                        range.insertNode(br);
                        range.setStartAfter(br);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    setTimeout(updateToolbarState, 0);
                    if (trackChanges) setTimeout(trackChanges, 0);
                    return;
                }
                e.preventDefault();
                try {
                    document.execCommand('insertParagraph', false, null);
                } catch {
                    return;
                }
                // If the new block is a div, replace it with p so we consistently use <p>.
                const block = getBlockElement(selection.anchorNode, editor);
                if (block && block !== editor && block.tagName === 'DIV') {
                    const p = document.createElement('p');
                    while (block.firstChild) {
                        p.appendChild(block.firstChild);
                    }
                    block.parentNode.replaceChild(p, block);
                }
                setTimeout(updateToolbarState, 0);
                if (trackChanges) setTimeout(trackChanges, 0);
                return;
            }
        }

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold', false, null);
                setTimeout(updateToolbarState, 0);
                if (trackChanges) setTimeout(trackChanges, 0);
            } else if (e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic', false, null);
                setTimeout(updateToolbarState, 0);
                if (trackChanges) setTimeout(trackChanges, 0);
            } else if (e.key === 'u') {
                e.preventDefault();
                document.execCommand('underline', false, null);
                setTimeout(updateToolbarState, 0);
                if (trackChanges) setTimeout(trackChanges, 0);
            }
        }
    });

    // Paste: plain text by default; Shift+Paste = paste with formatting
    document.getElementById('noteContent').addEventListener('paste', async (e) => {
        if (typeof isHtmlMode === 'function' && isHtmlMode()) return;
        const handled = await handleSmartPaste(e);
        if (!handled) return;
        setTimeout(updateToolbarState, 0);
        if (trackChanges) trackChanges();
    });

    // Inline shortcuts:
    // - type ";0" to clear formatting
    // - type ";p" to convert the current block back to a paragraph
    // - type ";1", ";2", ";3" to apply H1/H2/H3
    // - type ";b", ";n", ";c" for bullet list, numbered list, code block
    // - type ";d" to insert date
    // - type ";v" to insert a checkmark
    // Update toolbar button states based on selection
    document.getElementById('noteContent').addEventListener('input', () => {
        const editorEl = document.getElementById('noteContent');
        removeInlineTypingMarkers(editorEl);
        resetEditorFormattingIfEmpty(editorEl);
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const { node, offset } = getTextNodeAndOffsetAtCaret(range);
            if (node && offset >= 2) {
                const shortcut = node.data.slice(offset - 2, offset);
                if (shortcut.length === 2 && shortcut[0] === ';' && ['0', 'p', '1', '2', '3', 'b', 'n', 'c', 'd', 'v'].includes(shortcut[1])) {
                    applyInlineShortcut(shortcut[1]);
                    return;
                }
            }
        }
        saveEditorSelection();
        updateToolbarState();
    });
    document.addEventListener('selectionchange', updateToolbarState);
    document.getElementById('noteContent').addEventListener('mouseup', () => {
        saveEditorSelection();
        updateToolbarState();
    });
    document.getElementById('noteContent').addEventListener('keyup', () => {
        saveEditorSelection();
        updateToolbarState();
    });
    document.getElementById('noteContent').addEventListener('focus', saveEditorSelection);
    
    // Handle Ctrl/Cmd+click on links to open them
    document.getElementById('noteContent').addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
            const link = e.target.closest('a');
            if (link && link.href) {
                e.preventDefault();
                window.open(link.href, '_blank', 'noopener,noreferrer');
            }
        }
    });
    
    // Track modifier key (Cmd/Ctrl) to change cursor on links
    const editor = document.querySelector('.editor');
    const handleModifierKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey) {
            editor?.classList.add('modifier-key-pressed');
        }
    };
    const handleModifierKeyUp = (e) => {
        if (!e.ctrlKey && !e.metaKey) {
            editor?.classList.remove('modifier-key-pressed');
        }
    };
    
    // Listen for modifier keys globally (not just in editor)
    document.addEventListener('keydown', handleModifierKeyDown);
    document.addEventListener('keyup', handleModifierKeyUp);
    
    // Also handle when mouse leaves the window (user releases key outside)
    window.addEventListener('blur', () => {
        editor?.classList.remove('modifier-key-pressed');
    });
}
