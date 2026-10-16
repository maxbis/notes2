// Insert functions for date and checkmark

function insertTextAtCursor(text) {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        let target = editor.lastElementChild;
        if (!target || !/^(P|DIV|H1|H2|H3|H4|PRE|BLOCKQUOTE|LI)$/i.test(target.tagName)) {
            target = document.createElement('p');
            target.appendChild(document.createElement('br'));
            editor.appendChild(target);
        }

        const needsPlaceholderCleanup = target.innerHTML === '<br>';
        if (needsPlaceholderCleanup) {
            target.textContent = '';
        }

        const textNode = document.createTextNode(text);
        target.appendChild(textNode);

        const range = document.createRange();
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    editor.focus();
}

export function insertDate() {
    const now = new Date();
    const dateString = now.toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    insertTextAtCursor(dateString);
}

export function insertCheckmark() {
    insertTextAtCursor('✅ ');
}
