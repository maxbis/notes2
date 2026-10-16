// UI indicators for unsaved changes and last saved time
import state from './state.js';
import { isMobileLayout } from './utils.js';

export function updateUnsavedIndicator() {
    const indicator = document.getElementById('unsavedIndicator');
    if (!indicator) return;
    
    if (state.hasUnsavedChanges) {
        indicator.classList.add('visible');
        indicator.setAttribute('tabindex', '0');
        indicator.title = state.isIndicatorSaveInProgress
            ? 'Saving...'
            : 'Unsaved changes — click to save now';
        indicator.setAttribute('aria-label', 'Unsaved changes — click to save now');

        // Mobile: show compact status
        if (isMobileLayout()) {
            const lastSavedEl = document.getElementById('lastSaved');
            if (lastSavedEl) lastSavedEl.textContent = state.isIndicatorSaveInProgress ? 'Saving…' : 'Unsaved';
        }
    } else {
        indicator.classList.remove('visible');
        indicator.setAttribute('tabindex', '-1');
        indicator.title = 'Saved';
        indicator.setAttribute('aria-label', 'Saved');
    }
}

export function updateLastSavedTime(date) {
    const lastSavedEl = document.getElementById('lastSaved');
    if (!lastSavedEl) return;
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    lastSavedEl.textContent = isMobileLayout()
        ? `Saved ${hours}:${minutes}`
        : `Saved at ${hours}:${minutes}:${seconds}`;
}
