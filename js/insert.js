// Insert functions for date and checkmark

export function insertDate() {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();
    
    // Get current date in European format (Dutch)
    const now = new Date();
    const dateString = now.toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Insert the date at the current cursor position
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(dateString);
        range.insertNode(textNode);
        
        // Move cursor to the end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If no selection, append at the end
        editor.focus();
        const textNode = document.createTextNode(dateString);
        editor.appendChild(textNode);
    }
    
    editor.focus();
}

export function insertCheckmark() {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();
    
    // Insert checkmark at the current cursor position
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode('✅ ');
        range.insertNode(textNode);
        
        // Move cursor to the end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If no selection, append at the end
        editor.focus();
        const textNode = document.createTextNode('✅ ');
        editor.appendChild(textNode);
    }
    
    editor.focus();
}
