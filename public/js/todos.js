const TODO_LIST_CLASS = 'todo-list';
const TODO_ITEM_CLASS = 'todo-item';
const TODO_CHECKBOX_CLASS = 'todo-checkbox';
let todoNormalizationSuspendDepth = 0;

function createTodoId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isValidIsoDate(value) {
    if (typeof value !== 'string' || value === '') return false;
    return !Number.isNaN(Date.parse(value));
}

function formatCompletionLabel(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';

    const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
    const year = new Intl.DateTimeFormat('en-GB', { year: '2-digit' }).format(date);
    return `completed @ ${day} ${month} ’${year}`;
}

function getDirectTodoCheckbox(item) {
    return Array.from(item.children).find((child) => child.classList.contains(TODO_CHECKBOX_CLASS)) || null;
}

function keepCaretBeforeTrailingTodoCheckbox(item, checkbox) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (range.startContainer !== item) return;

    const checkboxIndex = Array.from(item.childNodes).indexOf(checkbox);
    if (checkboxIndex < 0 || range.startOffset <= checkboxIndex) return;

    const nextRange = document.createRange();
    nextRange.setStart(item, checkboxIndex);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
}

function syncTodoCheckbox(item) {
    let checkbox = getDirectTodoCheckbox(item);
    if (!checkbox) {
        checkbox = document.createElement('span');
        checkbox.className = TODO_CHECKBOX_CLASS;
        item.appendChild(checkbox);
    } else if (checkbox !== item.lastChild) {
        item.appendChild(checkbox);
    }

    checkbox.setAttribute('contenteditable', 'false');
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('tabindex', '0');

    const completed = isValidIsoDate(item.dataset.todoCompletedAt);
    checkbox.setAttribute('aria-checked', completed ? 'true' : 'false');

    if (completed) {
        item.dataset.todoCompletedLabel = formatCompletionLabel(item.dataset.todoCompletedAt);
    } else {
        delete item.dataset.todoCompletedAt;
        delete item.dataset.todoCompletedLabel;
    }

    keepCaretBeforeTrailingTodoCheckbox(item, checkbox);
    return checkbox;
}

function getTodoItems(root) {
    if (!root) return [];

    const items = [];
    root.querySelectorAll(`ul.${TODO_LIST_CLASS}`).forEach((list) => {
        Array.from(list.children).forEach((child) => {
            if (child.tagName === 'LI') items.push(child);
        });
    });
    return items;
}

export function normalizeTodoItems(root = document.getElementById('noteContent')) {
    if (!root) return false;

    let changed = false;
    root.querySelectorAll(`li.${TODO_ITEM_CLASS}`).forEach((item) => {
        const list = item.parentElement;
        if (list?.tagName === 'UL' && !list.classList.contains(TODO_LIST_CLASS)) {
            list.classList.add(TODO_LIST_CLASS);
            changed = true;
        }
    });

    root.querySelectorAll(`ul.${TODO_LIST_CLASS}`).forEach((list) => {
        const parent = list.parentElement;
        if (!parent || parent === root || !['P', 'DIV', 'H1', 'H2', 'H3', 'H4'].includes(parent.tagName)) return;

        const hasOtherContent = Array.from(parent.childNodes).some((node) => {
            if (node === list) return false;
            if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').trim() !== '';
            return node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR';
        });
        if (hasOtherContent) return;

        parent.replaceWith(list);
        changed = true;
    });

    const seenIds = new Set();
    const now = new Date().toISOString();

    getTodoItems(root).forEach((item) => {
        if (!item.classList.contains(TODO_ITEM_CLASS)) {
            item.classList.add(TODO_ITEM_CLASS);
            changed = true;
        }

        let id = item.dataset.todoId || '';
        if (!id || seenIds.has(id)) {
            id = createTodoId();
            item.dataset.todoId = id;
            item.dataset.todoCreatedAt = now;
            delete item.dataset.todoCompletedAt;
            delete item.dataset.todoCompletedLabel;
            changed = true;
        }
        seenIds.add(id);

        if (!isValidIsoDate(item.dataset.todoCreatedAt)) {
            item.dataset.todoCreatedAt = now;
            changed = true;
        }

        const existingCheckboxes = Array.from(item.children)
            .filter((child) => child.classList.contains(TODO_CHECKBOX_CLASS));
        if (existingCheckboxes.length > 1) {
            existingCheckboxes.slice(1).forEach((checkbox) => checkbox.remove());
            changed = true;
        }

        const before = item.outerHTML;
        syncTodoCheckbox(item);
        if (item.outerHTML !== before) changed = true;
    });

    root.querySelectorAll(`.${TODO_CHECKBOX_CLASS}`).forEach((checkbox) => {
        const item = checkbox.parentElement;
        const list = item?.parentElement;
        const isValidTodoCheckbox = item?.matches(`li.${TODO_ITEM_CLASS}`)
            && list?.matches(`ul.${TODO_LIST_CLASS}`);
        if (isValidTodoCheckbox) return;

        checkbox.remove();
        changed = true;
    });

    return changed;
}

export function runWithoutTodoNormalization(callback) {
    todoNormalizationSuspendDepth += 1;
    try {
        return callback();
    } finally {
        todoNormalizationSuspendDepth = Math.max(0, todoNormalizationSuspendDepth - 1);
    }
}

function getSelectionElement() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const node = selection.anchorNode;
    return node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

function getSelectedLists(editor, selector) {
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    return Array.from(editor.querySelectorAll(selector)).filter((list) => {
        try {
            return range.intersectsNode(list);
        } catch {
            return list.contains(selection.anchorNode);
        }
    });
}

function removeTodoItemMetadata(item) {
    item.classList.remove(TODO_ITEM_CLASS);
    if (!item.className) item.removeAttribute('class');
    delete item.dataset.todoId;
    delete item.dataset.todoCreatedAt;
    delete item.dataset.todoCompletedAt;
    delete item.dataset.todoCompletedLabel;
    getDirectTodoCheckbox(item)?.remove();
}

function removeTodoMetadata(list) {
    list.classList.remove(TODO_LIST_CLASS);
    if (!list.className) list.removeAttribute('class');

    Array.from(list.children).forEach((item) => {
        if (item.tagName === 'LI') removeTodoItemMetadata(item);
    });
}

function getSelectedTodoItems(editor) {
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
    const anchorItem = anchorElement?.closest?.(`li.${TODO_ITEM_CLASS}`);
    if (range.collapsed) {
        return anchorItem && editor.contains(anchorItem) ? [anchorItem] : [];
    }

    return Array.from(editor.querySelectorAll(`li.${TODO_ITEM_CLASS}`)).filter((item) => {
        try {
            return range.intersectsNode(item);
        } catch {
            return item === anchorItem;
        }
    });
}

export function clearTodoFormattingForSelection(editor = document.getElementById('noteContent')) {
    const items = getSelectedTodoItems(editor);
    if (!items.length) return false;

    const lists = new Set(items.map((item) => item.parentElement).filter(Boolean));
    items.forEach(removeTodoItemMetadata);
    lists.forEach((list) => {
        const hasTodoItems = Array.from(list.children)
            .some((item) => item.matches?.(`li.${TODO_ITEM_CLASS}`));
        if (hasTodoItems) return;

        list.classList.remove(TODO_LIST_CLASS);
        if (!list.className) list.removeAttribute('class');
    });

    return true;
}

export function toggleTodoList() {
    const editor = document.getElementById('noteContent');
    if (!editor) return false;

    const selectedTodoLists = getSelectedLists(editor, `ul.${TODO_LIST_CLASS}`);
    if (selectedTodoLists.length) {
        selectedTodoLists.forEach(removeTodoMetadata);
        return true;
    }

    let selectedLists = getSelectedLists(editor, 'ul');
    if (!selectedLists.length) {
        document.execCommand('insertUnorderedList', false, null);
        selectedLists = getSelectedLists(editor, 'ul');
    }

    if (!selectedLists.length) {
        const element = getSelectionElement();
        const list = element?.closest?.('ul');
        if (list && editor.contains(list)) selectedLists = [list];
    }

    selectedLists.forEach((list) => list.classList.add(TODO_LIST_CLASS));
    normalizeTodoItems(editor);
    return selectedLists.length > 0;
}

export function isSelectionInTodoList(editor, anchorNode = null) {
    const node = anchorNode || window.getSelection()?.anchorNode;
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const list = element?.closest?.(`ul.${TODO_LIST_CLASS}`);
    return !!(list && editor?.contains(list));
}

function toggleTodoCompletion(item) {
    if (!item) return;

    if (isValidIsoDate(item.dataset.todoCompletedAt)) {
        delete item.dataset.todoCompletedAt;
        delete item.dataset.todoCompletedLabel;
    } else {
        item.dataset.todoCompletedAt = new Date().toISOString();
    }

    syncTodoCheckbox(item);
    item.dispatchEvent(new Event('input', { bubbles: true }));
}

function getSelectionTodoItem(editor) {
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;

    const node = selection.anchorNode;
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const item = element?.closest?.(`li.${TODO_ITEM_CLASS}`);
    return item && editor.contains(item) ? item : null;
}

function isTodoItemEmpty(item) {
    const content = item.cloneNode(true);
    content.querySelectorAll(`.${TODO_CHECKBOX_CLASS}`).forEach((checkbox) => checkbox.remove());

    const text = (content.textContent || '')
        .replace(/[\u200B\u00A0]/g, '')
        .trim();
    if (text !== '') return false;

    return !content.querySelector('img, video, audio, iframe, object, embed, svg, canvas, table, hr');
}

function placeCaretAtEnd(element) {
    const selection = window.getSelection();
    if (!selection || !element) return;

    let lastTextNode = null;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement?.closest?.(`.${TODO_CHECKBOX_CLASS}`)) lastTextNode = node;
    }

    const range = document.createRange();
    if (lastTextNode) {
        range.setStart(lastTextNode, lastTextNode.data.length);
    } else {
        range.setStart(element, element.childNodes.length);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function createEmptyParagraph() {
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));
    return paragraph;
}

function removeEmptyTodoItem(editor, item) {
    const list = item.parentElement;
    if (!list?.matches(`ul.${TODO_LIST_CLASS}`)) return false;

    const previousItem = item.previousElementSibling?.tagName === 'LI'
        ? item.previousElementSibling
        : null;
    const nextItem = item.nextElementSibling?.tagName === 'LI'
        ? item.nextElementSibling
        : null;

    if (previousItem) {
        item.remove();
        placeCaretAtEnd(previousItem);
    } else {
        const paragraph = createEmptyParagraph();
        if (nextItem) {
            list.before(paragraph);
            item.remove();
        } else {
            list.replaceWith(paragraph);
        }
        placeCaretAtEnd(paragraph);
    }

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

export function setupTodoInteractions() {
    const editor = document.getElementById('noteContent');
    if (!editor) return;

    editor.addEventListener('pointerdown', (event) => {
        const checkbox = event.target.closest?.(`.${TODO_CHECKBOX_CLASS}`);
        if (checkbox && editor.contains(checkbox)) event.preventDefault();
    });

    editor.addEventListener('click', (event) => {
        const checkbox = event.target.closest?.(`.${TODO_CHECKBOX_CLASS}`);
        if (!checkbox || !editor.contains(checkbox)) return;

        event.preventDefault();
        toggleTodoCompletion(checkbox.closest(`li.${TODO_ITEM_CLASS}`));
    });

    editor.addEventListener('keydown', (event) => {
        const checkbox = event.target.closest?.(`.${TODO_CHECKBOX_CLASS}`);
        if (!checkbox && event.key === 'Backspace' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const item = getSelectionTodoItem(editor);
            if (item && isTodoItemEmpty(item)) {
                event.preventDefault();
                removeEmptyTodoItem(editor, item);
                return;
            }
        }

        if (!checkbox || !editor.contains(checkbox) || !['Enter', ' '].includes(event.key)) return;

        event.preventDefault();
        toggleTodoCompletion(checkbox.closest(`li.${TODO_ITEM_CLASS}`));
    });

    editor.addEventListener('input', () => {
        if (todoNormalizationSuspendDepth === 0) normalizeTodoItems(editor);
    });

    normalizeTodoItems(editor);
}
