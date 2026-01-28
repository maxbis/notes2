// Formatting toolbar setup and state management
import { escapeHtml } from './utils.js';
import { isHtmlMode } from './state.js';

// These will be imported from other modules
let trackChanges = null;
let showLinkDialog = null;
let insertDate = null;
let insertCheckmark = null;

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

export function updateToolbarState() {
    const editor = document.getElementById('noteContent');
    if (!editor) return;

    const selection = window.getSelection();
    const anchorNode = selection && selection.anchorNode ? selection.anchorNode : null;
    const isInEditor = document.activeElement === editor || (anchorNode && editor.contains(anchorNode));
    if (!isInEditor) return;

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');
    const underlineBtnMobile = document.getElementById('underlineBtnMobile');
    const bulletListBtn = document.getElementById('bulletListBtn');
    const bulletListBtnMobile = document.getElementById('bulletListBtnMobile');
    const numberedListBtn = document.getElementById('numberedListBtn');
    const h1Btn = document.getElementById('h1Btn');
    const h2Btn = document.getElementById('h2Btn');
    const h3Btn = document.getElementById('h3Btn');
    const preBtn = document.getElementById('preBtn');
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
    setPressed(bulletListBtn, document.queryCommandState('insertUnorderedList'));
    setPressed(bulletListBtnMobile, document.queryCommandState('insertUnorderedList'));
    setPressed(numberedListBtn, document.queryCommandState('insertOrderedList'));

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
    const bindClickIfExists = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', handler);
    };

    const focusEditorAndSync = () => {
        const editor = document.getElementById('noteContent');
        if (editor) editor.focus();
        updateToolbarState();
        if (trackChanges) trackChanges();
    };

    document.getElementById('boldBtn').addEventListener('click', () => {
        document.execCommand('bold', false, null);
        focusEditorAndSync();
    });
    
    document.getElementById('italicBtn').addEventListener('click', () => {
        document.execCommand('italic', false, null);
        focusEditorAndSync();
    });
    
    bindClickIfExists('underlineBtn', () => {
        document.execCommand('underline', false, null);
        focusEditorAndSync();
    });
    
    document.getElementById('bulletListBtn').addEventListener('click', () => {
        document.execCommand('insertUnorderedList', false, null);
        focusEditorAndSync();
    });
    
    document.getElementById('numberedListBtn').addEventListener('click', () => {
        document.execCommand('insertOrderedList', false, null);
        focusEditorAndSync();
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

    const applyBlock = (tag) => {
        document.execCommand('formatBlock', false, tag);
        focusEditorAndSync();
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

    bindClickIfExists('h1Btn', () => applyBlock('h1'));
    bindClickIfExists('h2Btn', () => applyBlock('h2'));
    bindClickIfExists('h3Btn', () => applyBlock('h3'));
    bindClickIfExists('clearFormatBtn', () => clearFormatting());
    bindClickIfExists('preBtn', togglePre);

    // Mobile overflow menu buttons (same actions)
    bindClickIfExists('h1BtnMobile', (e) => {
        applyBlock('h1');
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('h2BtnMobile', (e) => {
        applyBlock('h2');
        closeParentDetails(e.currentTarget);
    });
    bindClickIfExists('h3BtnMobile', (e) => {
        applyBlock('h3');
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
        if (insertDate) insertDate();
        if (trackChanges) trackChanges();
    });
    
    document.getElementById('insertCheckmarkBtn').addEventListener('click', () => {
        if (insertCheckmark) insertCheckmark();
        if (trackChanges) trackChanges();
    });
    
    // Keyboard shortcuts
    document.getElementById('noteContent').addEventListener('keydown', (e) => {
        // Only apply custom shortcuts in visual mode (not HTML source mode).
        if (typeof isHtmlMode === 'function' && isHtmlMode()) {
            return;
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
            }
        }
    });

    // Inline shortcuts:
    // - type ";d" to insert date
    // - type ";v" to insert a checkmark
    document.getElementById('noteContent').addEventListener('beforeinput', (e) => {
        // Only handle literal character insertions (avoid paste, delete, IME composition, etc.)
        if (e.inputType !== 'insertText' || typeof e.data !== 'string') return;
        if (e.data !== 'd' && e.data !== 'v') return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;

        const { node, offset } = getTextNodeAndOffsetAtCaret(range);
        if (!node || offset < 1) return;

        // Only trigger if the character immediately before the caret is ';'
        if (node.data[offset - 1] !== ';') return;

        // Prevent inserting the typed character ('d'/'v'), then replace ";d"/";v"
        e.preventDefault();

        // Delete the ';' before the caret
        const deleteRange = document.createRange();
        deleteRange.setStart(node, offset - 1);
        deleteRange.setEnd(node, offset);
        deleteRange.deleteContents();

        // Place caret where the ';' was, then insert replacement
        const newRange = document.createRange();
        newRange.setStart(node, offset - 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        if (e.data === 'd') {
            if (insertDate) insertDate();
        } else {
            if (insertCheckmark) insertCheckmark();
        }
        if (trackChanges) trackChanges();
    });
    
    // Update toolbar button states based on selection
    document.getElementById('noteContent').addEventListener('input', updateToolbarState);
    document.addEventListener('selectionchange', updateToolbarState);
    document.getElementById('noteContent').addEventListener('mouseup', updateToolbarState);
    document.getElementById('noteContent').addEventListener('keyup', updateToolbarState);
    
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
