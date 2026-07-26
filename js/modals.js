// Promise-based modal dialogs with shared accessibility and focus management.

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

let lastDialogTrigger = null;

document.addEventListener('pointerdown', (event) => {
    const trigger = event.target instanceof Element
        ? event.target.closest('button, a[href], summary, [role="button"]')
        : null;
    if (trigger instanceof HTMLElement && !trigger.closest('.modal-overlay')) {
        lastDialogTrigger = trigger;
    }
}, true);

document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('.modal-overlay')) return;
    if (target.matches('button, a[href], summary, [role="button"]')) {
        lastDialogTrigger = target;
    }
});

function openDialog(overlay, { initialFocus = null, onDismiss }) {
    const dialog = overlay.querySelector('[role="dialog"]');
    const closeBtn = overlay.querySelector('[data-dialog-close]');
    const activeElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocus = lastDialogTrigger?.isConnected
        ? lastDialogTrigger
        : activeElement;
    let dismissible = true;
    let closed = false;

    const getFocusable = () => Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

    const requestDismiss = () => {
        if (dismissible) onDismiss();
    };

    const handleBackdropClick = (event) => {
        if (event.target === overlay) requestDismiss();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            if (dismissible) {
                event.preventDefault();
                event.stopPropagation();
                onDismiss();
            }
            return;
        }

        if (event.key !== 'Tab') return;

        const focusable = getFocusable();
        if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    overlay.classList.add('active', 'is-open');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.addEventListener('click', handleBackdropClick);
    closeBtn?.addEventListener('click', requestDismiss);
    document.addEventListener('keydown', handleKeyDown, true);

    requestAnimationFrame(() => {
        const target = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
        (target || getFocusable()[0] || dialog).focus();
    });

    return {
        close() {
            if (closed) return;
            closed = true;
            overlay.classList.remove('active', 'is-open');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.removeEventListener('click', handleBackdropClick);
            closeBtn?.removeEventListener('click', requestDismiss);
            document.removeEventListener('keydown', handleKeyDown, true);
            requestAnimationFrame(() => {
                if (returnFocus?.isConnected) returnFocus.focus();
            });
        },
        setDismissible(value) {
            dismissible = Boolean(value);
            closeBtn?.toggleAttribute('disabled', !dismissible);
        }
    };
}

function setButtonVariant(button, variant) {
    button.className = `btn-${variant === 'danger' ? 'danger' : 'primary'} wp-button wp-button--${variant}`;
}

function showConfirmation({
    title,
    message,
    confirmText,
    cancelText,
    danger = false
}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        let session;

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        setButtonVariant(confirmBtn, danger ? 'danger' : 'primary');

        const finish = (result) => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            session.close();
            setButtonVariant(confirmBtn, 'primary');
            resolve(result);
        };
        const handleConfirm = () => finish(true);
        const handleCancel = () => finish(false);

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        session = openDialog(overlay, {
            initialFocus: danger ? cancelBtn : confirmBtn,
            onDismiss: handleCancel
        });
    });
}

export function showModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return showConfirmation({ title, message, confirmText, cancelText });
}

export function showLinkDialog(selectedText = '', existingUrl = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('linkModalOverlay');
        const titleInput = document.getElementById('linkModalTitleInput');
        const urlInput = document.getElementById('linkModalUrlInput');
        const insertBtn = document.getElementById('linkModalInsertBtn');
        const cancelBtn = document.getElementById('linkModalCancelBtn');
        let session;

        titleInput.value = selectedText;
        urlInput.value = existingUrl;
        urlInput.removeAttribute('aria-invalid');

        const cleanup = (result) => {
            insertBtn.removeEventListener('click', handleInsert);
            cancelBtn.removeEventListener('click', handleCancel);
            titleInput.removeEventListener('keydown', handleEnter);
            urlInput.removeEventListener('keydown', handleEnter);
            session.close();
            resolve(result);
        };

        const handleInsert = () => {
            const url = urlInput.value.trim();
            if (!url) {
                urlInput.setAttribute('aria-invalid', 'true');
                urlInput.focus();
                return;
            }
            urlInput.removeAttribute('aria-invalid');
            cleanup({ title: titleInput.value.trim(), url });
        };
        const handleCancel = () => cleanup(null);
        const handleEnter = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleInsert();
            }
        };

        insertBtn.addEventListener('click', handleInsert);
        cancelBtn.addEventListener('click', handleCancel);
        titleInput.addEventListener('keydown', handleEnter);
        urlInput.addEventListener('keydown', handleEnter);

        const focusTarget = existingUrl ? titleInput : urlInput;
        session = openDialog(overlay, {
            initialFocus: focusTarget,
            onDismiss: handleCancel
        });
        if (existingUrl) requestAnimationFrame(() => titleInput.select());
    });
}

/**
 * @param {string} url - Public link URL
 * @param {string|{ title?: string, publicDefaultHashId?: string|null, currentHashId?: string|null, onSetEasyAccess?: () => Promise<void>|void, onRemoveEasyAccess?: () => Promise<void>|void }} titleOrOptions
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
        const footer = confirmBtn.parentElement;
        const actionButtons = [];
        let session;

        titleEl.textContent = title;
        messageEl.textContent = url;
        cancelBtn.textContent = 'Close';
        confirmBtn.hidden = true;

        const addAction = (text, className, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className;
            button.textContent = text;
            button.addEventListener('click', handler);
            footer.insertBefore(button, confirmBtn);
            actionButtons.push([button, handler]);
            return button;
        };

        const cleanup = (result) => {
            cancelBtn.removeEventListener('click', handleCancel);
            actionButtons.forEach(([button, handler]) => {
                button.removeEventListener('click', handler);
                button.remove();
            });
            confirmBtn.hidden = false;
            confirmBtn.textContent = 'Confirm';
            cancelBtn.textContent = 'Cancel';
            session.close();
            resolve(result);
        };
        const handleCancel = () => cleanup('close');
        const handleOpen = () => {
            if (url) window.open(url, '_blank', 'noopener');
            cleanup('open');
        };
        const runSettingAction = (callback, result) => {
            session.setDismissible(false);
            Promise.resolve(callback()).then(() => {
                cleanup(result);
            }).catch((error) => {
                session.setDismissible(true);
                console.error('Easy access update failed:', error);
            });
        };

        if (showEasyAccess && onSetEasyAccess && !isCurrentDefault) {
            addAction(
                'Copy link + Easy access',
                'btn-secondary wp-button wp-button--secondary',
                () => runSettingAction(onSetEasyAccess, 'easy_access_set')
            );
        }
        if (showEasyAccess && onRemoveEasyAccess && isCurrentDefault) {
            addAction(
                'Remove easy access',
                'btn-secondary wp-button wp-button--secondary',
                () => runSettingAction(onRemoveEasyAccess, 'easy_access_removed')
            );
        }
        const openBtn = addAction(
            'Open',
            'btn-primary wp-button wp-button--primary',
            handleOpen
        );

        cancelBtn.addEventListener('click', handleCancel);
        session = openDialog(overlay, {
            initialFocus: openBtn,
            onDismiss: handleCancel
        });
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
    const behindText = Number.isFinite(behindBy) && behindBy > 0
        ? `\n\nYou are ${behindBy} version(s) behind.`
        : '';
    const message = `This note was modified by another session and saved at ${serverTime}.${behindText}\n\n`
        + 'Your current changes will overwrite those changes.\n\n'
        + 'Do you want to overwrite the server version?';

    return showModal('⚠️ Conflict Detected', message, 'Overwrite', 'Cancel & Refresh');
}

export function showDeleteConfirmDialog() {
    return showConfirmation({
        title: 'Delete Note',
        message: 'Are you sure you want to delete this note? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true
    });
}

export function showPasteChoiceDialog() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const footer = confirmBtn.parentElement;
        const plainTextBtn = document.createElement('button');
        let session;

        titleEl.textContent = 'Paste Markdown';
        messageEl.textContent = 'Markdown was detected in the pasted text. Do you want to convert it to formatted HTML or paste it as plain text?';
        confirmBtn.textContent = 'Convert Markdown';
        cancelBtn.textContent = 'Cancel';
        setButtonVariant(confirmBtn, 'primary');
        plainTextBtn.type = 'button';
        plainTextBtn.className = 'btn-secondary wp-button wp-button--secondary';
        plainTextBtn.textContent = 'Paste Plain Text';
        footer.insertBefore(plainTextBtn, confirmBtn);

        const cleanup = (result) => {
            confirmBtn.removeEventListener('click', handleMarkdown);
            plainTextBtn.removeEventListener('click', handlePlainText);
            cancelBtn.removeEventListener('click', handleCancel);
            plainTextBtn.remove();
            confirmBtn.textContent = 'Confirm';
            session.close();
            resolve(result);
        };
        const handleMarkdown = () => cleanup('markdown');
        const handlePlainText = () => cleanup('plain_text');
        const handleCancel = () => cleanup('cancel');

        confirmBtn.addEventListener('click', handleMarkdown);
        plainTextBtn.addEventListener('click', handlePlainText);
        cancelBtn.addEventListener('click', handleCancel);
        session = openDialog(overlay, {
            initialFocus: confirmBtn,
            onDismiss: handleCancel
        });
    });
}
