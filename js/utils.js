// Utility functions

export function isMobileLayout() {
    const mobileLayoutQuery = [
        '(max-width: 768px)',
        '(max-height: 500px) and (orientation: landscape) and (pointer: coarse)',
    ].join(', ');

    return Boolean(window.matchMedia && window.matchMedia(mobileLayoutQuery).matches);
}

export function getPublicLink(publicToken) {
    if (!publicToken) return '';
    const u = new URL('public.php', window.location.href);
    u.searchParams.set('id', publicToken);
    return u.toString();
}

export function getEditorLink(hashId) {
    if (!hashId) return '';
    const u = new URL('app.php', window.location.href);
    u.searchParams.set('note', hashId);
    return u.toString();
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function stripHtmlTags(html) {
    // Create a temporary DOM element to parse HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Get text content which automatically strips all HTML tags
    return tmp.textContent || tmp.innerText || '';
}

function normalizeNoteTextContent(content) {
    return stripHtmlTags(content || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\u200b/g, '')
        .trim()
        .toLowerCase();
}

/** Returns true if the note has meaningful content (title, tags, or non-empty text after stripping HTML). */
export function hasMeaningfulNoteContent(title, content, tags = []) {
    const titleTrimmed = (title || '').trim();
    const textFromContent = normalizeNoteTextContent(content);
    if (titleTrimmed.length > 0) return true;
    if (Array.isArray(tags) && tags.some(tag => String(tag ?? '').trim() !== '')) return true;
    if (textFromContent.length === 0) return false;
    // The new-note placeholder should never count as real content.
    return textFromContent !== 'empty note';
}

export function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}
