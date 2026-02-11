// Utility functions

export function isMobileLayout() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

export function getPublicLink(hashId) {
    if (!hashId) return '';
    const u = new URL('public.php', window.location.href);
    u.searchParams.set('id', hashId);
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

/** Returns true if the note has meaningful content (title or non-empty text after stripping HTML). */
export function hasMeaningfulNoteContent(title, content) {
    const titleTrimmed = (title || '').trim();
    const textFromContent = stripHtmlTags(content || '').trim();
    return titleTrimmed.length > 0 || textFromContent.length > 0;
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
