import { stripHtmlTags } from './utils.js';

const PREVIEW_LENGTH = 160;

function previewFromContent(content) {
    const plainText = stripHtmlTags(content || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (plainText.length <= PREVIEW_LENGTH) return plainText;
    return `${plainText.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

export function noteToSummary(note) {
    return {
        hash_id: note?.hash_id || '',
        public_token: note?.public_token || null,
        is_published: Number(note?.is_published) === 1 ? 1 : 0,
        title: note?.title || '',
        preview: typeof note?.preview === 'string'
            ? note.preview
            : previewFromContent(note?.content || ''),
        is_pinned: Number(note?.is_pinned) === 1 ? 1 : 0,
        created_at: note?.created_at || null,
        updated_at: note?.updated_at || null,
        version: note?.version != null ? Number(note.version) : null,
        tags: Array.isArray(note?.tags) ? note.tags : []
    };
}

export function upsertNoteSummary(notes, note, prependIfMissing = true) {
    const summaries = Array.isArray(notes) ? notes : [];
    const summary = noteToSummary(note);
    const index = summaries.findIndex(item => item.hash_id === summary.hash_id);

    if (index === -1) {
        if (prependIfMissing) summaries.unshift(summary);
        return summary;
    }

    summaries[index] = {
        ...summaries[index],
        ...summary
    };
    return summaries[index];
}
