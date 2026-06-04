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

/**
 * @param {string} url - Public link URL
 * @param {string|{ title?: string, publicDefaultHashId?: string|null, currentHashId?: string|null, onSetEasyAccess?: () => Promise<void>|void, onRemoveEasyAccess?: () => Promise<void>|void }} titleOrOptions - Title string or options object
 */
export function showShareDialog(url, titleOrOptions = 'Share link copied') {
    const opts = typeof titleOrOptions === 'object' && titleOrOptions !== null
        ? titleOrOptions
        : { title: titleOrOptions };
    const title = opts.title ?? 'Share link copied';
    const publicDefaultHashId = opts.publicDefaultHashId ?? null;
    const currentHashId = opts.currentHashId ?? null;
    const onSetEasyAccess = opts.onSetEasyAccess ?? null;
    const onRemoveEasyAccess = opts.onRemoveEasyAccess ?? null;
    const showEasyAccess = Boolean(currentHashId && (onSetEasyAccess || onRemoveEasyAccess));
    const isCurrentDefault = Boolean(publicDefaultHashId && currentHashId && publicDefaultHashId === currentHashId);

    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const footer = confirmBtn?.parentElement;

        const originalConfirmText = confirmBtn.textContent;
        const originalCancelText = cancelBtn.textContent;
        const originalConfirmClassName = confirmBtn.className;
        const originalCancelClassName = cancelBtn.className;

        titleEl.textContent = title;
        messageEl.textContent = url;
        cancelBtn.textContent = 'Close';
        confirmBtn.textContent = '';

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn-primary';
        openBtn.textContent = 'Open';

        confirmBtn.style.display = 'none';
        if (footer) {
            footer.insertBefore(openBtn, confirmBtn);
        }

        const extraButtons = [];
        if (showEasyAccess && onSetEasyAccess && !isCurrentDefault) {
            const setEasyBtn = document.createElement('button');
            setEasyBtn.type = 'button';
            setEasyBtn.className = 'btn-secondary';
            setEasyBtn.textContent = 'Copy link + Easy access';
            extraButtons.push(setEasyBtn);
            if (footer) footer.insertBefore(setEasyBtn, openBtn);
        }
        if (showEasyAccess && onRemoveEasyAccess && isCurrentDefault) {
            const removeEasyBtn = document.createElement('button');
            removeEasyBtn.type = 'button';
            removeEasyBtn.className = 'btn-secondary';
            removeEasyBtn.textContent = 'Remove easy access';
            extraButtons.push(removeEasyBtn);
            if (footer) footer.insertBefore(removeEasyBtn, openBtn);
        }

        overlay.classList.add('active');

        const cleanup = () => {
            overlay.classList.remove('active');
            openBtn.removeEventListener('click', handleOpen);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            extraButtons.forEach((btn, i) => {
                btn.removeEventListener('click', extraHandlers[i]);
                if (footer && btn.parentElement === footer) footer.removeChild(btn);
            });
            if (footer && openBtn.parentElement === footer) {
                footer.removeChild(openBtn);
            }
            confirmBtn.textContent = originalConfirmText;
            cancelBtn.textContent = originalCancelText;
            confirmBtn.className = originalConfirmClassName;
            cancelBtn.className = originalCancelClassName;
            confirmBtn.style.display = '';
        };

        const handleOpen = () => {
            cleanup();
            if (url) {
                window.open(url, '_blank', 'noopener');
            }
            resolve('open');
        };

        const handleCancel = () => {
            cleanup();
            resolve('close');
        };

        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };

        const handleSetEasyAccess = () => {
            Promise.resolve(onSetEasyAccess()).then(() => {
                cleanup();
                resolve('easy_access_set');
            }).catch((err) => {
                console.error('Set easy access failed:', err);
            });
        };
        const handleRemoveEasyAccess = () => {
            Promise.resolve(onRemoveEasyAccess()).then(() => {
                cleanup();
                resolve('easy_access_removed');
            }).catch((err) => {
                console.error('Remove easy access failed:', err);
            });
        };
        const extraHandlers = [];
        if (showEasyAccess && onSetEasyAccess && !isCurrentDefault) {
            extraHandlers.push(handleSetEasyAccess);
        }
        if (showEasyAccess && onRemoveEasyAccess && isCurrentDefault) {
            extraHandlers.push(handleRemoveEasyAccess);
        }
        extraButtons.forEach((btn, i) => btn.addEventListener('click', extraHandlers[i]));

        openBtn.addEventListener('click', handleOpen);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
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

export function showPasteChoiceDialog() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const footer = confirmBtn?.parentElement;

        const originalConfirmText = confirmBtn.textContent;
        const originalCancelText = cancelBtn.textContent;
        const originalConfirmClassName = confirmBtn.className;
        const originalCancelClassName = cancelBtn.className;

        titleEl.textContent = 'Paste Markdown';
        messageEl.textContent = 'Markdown was detected in the pasted text. Do you want to convert it to formatted HTML or paste it as plain text?';
        confirmBtn.textContent = 'Convert Markdown';
        cancelBtn.textContent = 'Cancel';

        const plainTextBtn = document.createElement('button');
        plainTextBtn.type = 'button';
        plainTextBtn.className = 'btn-secondary';
        plainTextBtn.textContent = 'Paste Plain Text';
        if (footer) {
            footer.insertBefore(plainTextBtn, confirmBtn);
        }

        overlay.classList.add('active');

        const cleanup = () => {
            overlay.classList.remove('active');
            confirmBtn.textContent = originalConfirmText;
            cancelBtn.textContent = originalCancelText;
            confirmBtn.className = originalConfirmClassName;
            cancelBtn.className = originalCancelClassName;
            confirmBtn.removeEventListener('click', handleMarkdown);
            plainTextBtn.removeEventListener('click', handlePlainText);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            if (footer && plainTextBtn.parentElement === footer) {
                footer.removeChild(plainTextBtn);
            }
        };

        const handleMarkdown = () => {
            cleanup();
            resolve('markdown');
        };

        const handlePlainText = () => {
            cleanup();
            resolve('plain_text');
        };

        const handleCancel = () => {
            cleanup();
            resolve('cancel');
        };

        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };

        confirmBtn.addEventListener('click', handleMarkdown);
        plainTextBtn.addEventListener('click', handlePlainText);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
    });
}
