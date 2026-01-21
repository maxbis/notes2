// Modal dialog functions

export function showModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        
        overlay.classList.add('active');
        
        const handleConfirm = () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
    });
}

export function showLinkDialog(selectedText = '', existingUrl = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('linkModalOverlay');
        const titleInput = document.getElementById('linkModalTitleInput');
        const urlInput = document.getElementById('linkModalUrlInput');
        const insertBtn = document.getElementById('linkModalInsertBtn');
        const cancelBtn = document.getElementById('linkModalCancelBtn');
        
        // Pre-fill title with selected text
        titleInput.value = selectedText;
        // Pre-fill URL if editing existing link
        urlInput.value = existingUrl;
        
        // Show modal and focus appropriate field
        overlay.classList.add('active');
        setTimeout(() => {
            if (existingUrl) {
                // If editing, focus title field
                titleInput.focus();
                titleInput.select();
            } else if (urlInput.value === '') {
                // If new link, focus URL input
                urlInput.focus();
            } else {
                titleInput.focus();
            }
        }, 100);
        
        const handleInsert = () => {
            const url = urlInput.value.trim();
            if (!url) {
                urlInput.focus();
                return;
            }
            
            const title = titleInput.value.trim();
            overlay.classList.remove('active');
            cleanup();
            resolve({ title, url });
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(null);
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };
        
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && (e.target === titleInput || e.target === urlInput)) {
                e.preventDefault();
                handleInsert();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };
        
        const cleanup = () => {
            insertBtn.removeEventListener('click', handleInsert);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            titleInput.removeEventListener('keydown', handleKeyDown);
            urlInput.removeEventListener('keydown', handleKeyDown);
        };
        
        insertBtn.addEventListener('click', handleInsert);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        titleInput.addEventListener('keydown', handleKeyDown);
        urlInput.addEventListener('keydown', handleKeyDown);
    });
}

export async function showConflictDialog(serverUpdatedAt, serverTitle, serverContent, behindBy) {
    const serverTime = (serverUpdatedAt instanceof Date ? serverUpdatedAt : new Date(serverUpdatedAt)).toLocaleString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    const behindText = (Number.isFinite(behindBy) && behindBy > 0)
        ? `\n\nYou are ${behindBy} version(s) behind.`
        : '';

    const message = `This note was modified by another session and saved at ${serverTime}.${behindText}\n\n` +
                   `Your current changes will overwrite those changes.\n\n` +
                   `Do you want to overwrite the server version?`;
    
    const confirmed = await showModal(
        '⚠️ Conflict Detected',
        message,
        'Overwrite',
        'Cancel & Refresh'
    );
    
    return confirmed;
}

export async function showDeleteConfirmDialog() {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    
    titleEl.textContent = 'Delete Note';
    messageEl.textContent = 'Are you sure you want to delete this note? This action cannot be undone.';
    confirmBtn.textContent = 'Delete';
    cancelBtn.textContent = 'Cancel';
    
    // Add danger class for delete button
    confirmBtn.classList.add('btn-danger');
    confirmBtn.classList.remove('btn-primary');
    
    overlay.classList.add('active');
    
    return new Promise((resolve) => {
        const handleConfirm = () => {
            overlay.classList.remove('active');
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
    });
}
