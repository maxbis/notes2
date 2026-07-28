// Promise-based modal dialogs with shared accessibility and focus management.

import { getNoteSharingStatus, SHARING_STATUS } from './sharing-state.js';

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

export function showShareDialog(options) {
    return new Promise((resolve) => {
        const opts = options || {};
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        let confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const dialog = overlay.querySelector('.wp-dialog');
        let note = opts.note || null;
        let confirmingRegenerate = false;
        let session;

        titleEl.textContent = 'Sharing';
        dialog?.classList.add('sharing-dialog-shell');
        cancelBtn.textContent = 'Close';
        confirmBtn.hidden = false;

        const copyText = async (value) => {
            if (!value) return false;
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(value);
                    return true;
                }
            } catch (error) {
                console.warn('Clipboard write failed:', error);
            }
            window.prompt('Copy this public link:', value);
            return true;
        };

        const createActionButton = (text, className, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className;
            button.textContent = text;
            button.addEventListener('click', handler);
            return button;
        };

        const clearActions = () => {
            const cleanConfirmBtn = confirmBtn.cloneNode(true);
            cleanConfirmBtn.disabled = false;
            confirmBtn.replaceWith(cleanConfirmBtn);
            confirmBtn = cleanConfirmBtn;
        };

        const cleanup = () => {
            const cleanConfirmBtn = confirmBtn.cloneNode(true);
            cleanConfirmBtn.disabled = false;
            confirmBtn.replaceWith(cleanConfirmBtn);
            confirmBtn = cleanConfirmBtn;
            confirmBtn.hidden = false;
            confirmBtn.textContent = 'Confirm';
            messageEl.replaceChildren();
            cancelBtn.textContent = 'Cancel';
            cancelBtn.removeEventListener('click', handleCancel);
            dialog?.classList.remove('sharing-dialog-shell');
            session.close();
            resolve(note);
        };
        const handleCancel = () => cleanup();

        const getDefaultPublishedUrl = () => {
            const publicUrl = opts.getUrl?.(note) || '';
            try {
                const defaultPublishedUrl = new URL(publicUrl);
                defaultPublishedUrl.search = '';
                defaultPublishedUrl.hash = '';
                return defaultPublishedUrl.toString();
            } catch {
                return '';
            }
        };

        const runAction = async (callback, { copy = false, success = '' } = {}) => {
            session.setDismissible(false);
            dialog?.querySelectorAll('button').forEach((button) => {
                button.disabled = true;
            });
            try {
                const updatedNote = await callback();
                if (updatedNote) note = updatedNote;
                confirmingRegenerate = false;
                const url = opts.getUrl?.(note) || '';
                if (copy && url) await copyText(url);
                render(typeof success === 'function' ? success(note) : success);
            } catch (error) {
                console.error('Sharing update failed:', error);
                render(error?.message || 'The sharing setting could not be updated.');
            } finally {
                session.setDismissible(true);
                dialog?.querySelectorAll('button').forEach((button) => {
                    button.disabled = false;
                });
            }
        };

        const render = (feedback = '') => {
            clearActions();
            const publicDefaultHashId = opts.getPublicDefaultHashId?.() ?? null;
            const sharingStatus = getNoteSharingStatus(note, publicDefaultHashId);
            const isPublished = sharingStatus !== SHARING_STATUS.PRIVATE;
            const isDefaultPublished = sharingStatus === SHARING_STATUS.DEFAULT_PUBLISHED;
            const url = isPublished ? (opts.getUrl?.(note) || '') : '';

            const content = document.createElement('div');
            content.className = 'sharing-dialog';

            const status = document.createElement('div');
            status.className = `sharing-status sharing-status--${sharingStatus.key}`;
            const statusLabel = document.createElement('strong');
            statusLabel.textContent = sharingStatus.label;
            const statusText = document.createElement('span');
            statusText.textContent = isDefaultPublished
                ? 'Anyone with the active link or the default public address can view this note.'
                : isPublished
                    ? 'Anyone with the active link can view this note.'
                    : 'Only people with editor access can view this note.';
            status.append(statusLabel, statusText);
            content.append(status);

            if (url) {
                const linkSection = document.createElement('section');
                linkSection.className = 'sharing-link-section';

                const field = document.createElement('label');
                field.className = 'sharing-link-field';
                const fieldLabel = document.createElement('span');
                fieldLabel.textContent = 'Public link';
                const input = document.createElement('input');
                input.type = 'text';
                input.readOnly = true;
                input.value = url;
                input.className = 'wp-input sharing-link-input';
                input.addEventListener('focus', () => input.select());
                field.append(fieldLabel, input);
                linkSection.append(field);

                const warning = document.createElement('p');
                warning.className = 'sharing-help';
                warning.textContent = 'Generating a new link immediately disables the current one.';
                linkSection.append(warning);

                const linkActions = document.createElement('div');
                linkActions.className = 'sharing-inline-actions';
                linkActions.append(
                    createActionButton(
                        'Generate new link',
                        'btn-secondary wp-button wp-button--secondary',
                        () => {
                            confirmingRegenerate = true;
                            render();
                            requestAnimationFrame(() => {
                                dialog?.querySelector('.sharing-regenerate-confirm')?.focus();
                            });
                        }
                    ),
                    createActionButton(
                        'Disable link',
                        'btn-danger wp-button wp-button--danger-subtle',
                        () => runAction(opts.onDisable, {
                            success: 'The note is private and the old link no longer works.'
                        })
                    )
                );
                if (!confirmingRegenerate) {
                    linkSection.append(linkActions);
                }

                if (confirmingRegenerate) {
                    const confirmation = document.createElement('div');
                    confirmation.className = 'sharing-regenerate-confirmation';
                    confirmation.setAttribute('role', 'alert');

                    const confirmationText = document.createElement('div');
                    const confirmationTitle = document.createElement('strong');
                    confirmationTitle.textContent = 'Generate a new public link?';
                    const confirmationDescription = document.createElement('span');
                    confirmationDescription.textContent = 'The current link will stop working immediately.';
                    confirmationText.append(confirmationTitle, confirmationDescription);

                    const confirmationActions = document.createElement('div');
                    confirmationActions.className = 'sharing-regenerate-actions';
                    confirmationActions.append(
                        createActionButton(
                            'Cancel',
                            'btn-secondary wp-button wp-button--secondary',
                            () => {
                                confirmingRegenerate = false;
                                render();
                            }
                        ),
                        createActionButton(
                            'Generate new link',
                            'btn-danger wp-button wp-button--danger-subtle sharing-regenerate-confirm',
                            () => runAction(opts.onRegenerate, {
                                copy: true,
                                success: 'New link generated and copied. The old link no longer works.'
                            })
                        )
                    );
                    confirmation.append(confirmationText, confirmationActions);
                    linkSection.append(confirmation);
                }

                const defaultPublishedUrl = getDefaultPublishedUrl();
                const currentDefaultNote = opts.getDefaultPublishedNote?.() || null;
                const defaultSection = document.createElement('section');
                defaultSection.className = 'sharing-default-section';

                const defaultHeading = document.createElement('div');
                defaultHeading.className = 'sharing-default-heading';
                const defaultTitle = document.createElement('strong');
                defaultTitle.textContent = 'Default Published';
                defaultHeading.append(defaultTitle);
                if (isDefaultPublished) {
                    const defaultBadge = document.createElement('span');
                    defaultBadge.className = 'sharing-default-badge is-active';
                    defaultBadge.textContent = 'Current';
                    defaultHeading.append(defaultBadge);
                }

                const defaultDescription = document.createElement('p');
                defaultDescription.className = 'sharing-default-description';
                if (isDefaultPublished) {
                    defaultDescription.append(document.createTextNode('Opening '));
                    if (defaultPublishedUrl) {
                        const defaultPublishedLink = document.createElement('a');
                        defaultPublishedLink.href = defaultPublishedUrl;
                        defaultPublishedLink.target = '_blank';
                        defaultPublishedLink.rel = 'noopener';
                        defaultPublishedLink.textContent = defaultPublishedUrl;
                        defaultDescription.append(defaultPublishedLink);
                    } else {
                        defaultDescription.append(document.createTextNode('the default public address'));
                    }
                    defaultDescription.append(document.createTextNode(' displays this note.'));
                } else {
                    const currentDefaultTitle = String(currentDefaultNote?.title || '').trim();
                    if (currentDefaultNote?.hash_id && currentDefaultNote.hash_id !== note?.hash_id) {
                        defaultDescription.textContent = currentDefaultTitle
                            ? `Making this note Default Published will replace “${currentDefaultTitle}”.`
                            : 'Making this note Default Published will replace the current default note.';
                    } else {
                        defaultDescription.textContent =
                            'No Default Published note is selected. The default public address will open this note.';
                    }
                }

                const defaultActions = document.createElement('div');
                defaultActions.className = 'sharing-default-actions';
                if (isDefaultPublished && defaultPublishedUrl) {
                    defaultActions.append(createActionButton(
                        'Copy default link',
                        'btn-secondary wp-button wp-button--secondary',
                        () => copyText(defaultPublishedUrl).then(() => render('Default link copied.'))
                    ));
                }
                defaultActions.append(createActionButton(
                    isDefaultPublished ? 'Remove as default' : 'Make Default Published',
                    'btn-secondary wp-button wp-button--secondary',
                    () => runAction(
                        isDefaultPublished ? opts.onRemoveDefaultPublished : opts.onSetDefaultPublished,
                        {
                            success: isDefaultPublished
                                ? 'Default Published status removed. The note is still Published.'
                                : `This note is now Default Published.${defaultPublishedUrl ? ` ${defaultPublishedUrl}` : ''}`
                        }
                    )
                ));

                defaultSection.append(defaultHeading, defaultDescription, defaultActions);
                linkSection.append(defaultSection);
                content.append(linkSection);
            } else {
                const help = document.createElement('p');
                help.className = 'sharing-help';
                help.textContent = 'Publish this note to create a revocable, read-only link.';
                content.append(help);
            }

            if (feedback) {
                const feedbackEl = document.createElement('div');
                feedbackEl.className = 'sharing-feedback';
                feedbackEl.setAttribute('role', 'status');
                feedbackEl.textContent = feedback;
                content.append(feedbackEl);
            }
            messageEl.replaceChildren(content);

            if (isPublished) {
                confirmBtn.textContent = 'Copy link';
                confirmBtn.addEventListener('click', () => copyText(url).then(() => render('Link copied.')));
            } else {
                confirmBtn.textContent = 'Publish & copy link';
                confirmBtn.addEventListener('click', () => runAction(
                    opts.onPublish,
                    { copy: true, success: 'Published. The new link was copied.' }
                ));
            }
        };

        cancelBtn.addEventListener('click', handleCancel);
        render();
        session = openDialog(overlay, {
            initialFocus: () => confirmBtn,
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

export function showDeleteConfirmDialog(isUnsavedDraft = false) {
    return showConfirmation({
        title: isUnsavedDraft ? 'Discard New Note' : 'Delete Note',
        message: isUnsavedDraft
            ? 'Discard this new note? Any unsaved content will be lost.'
            : 'Are you sure you want to delete this note? This action cannot be undone.',
        confirmText: isUnsavedDraft ? 'Discard' : 'Delete',
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
