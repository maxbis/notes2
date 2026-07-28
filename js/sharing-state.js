export const SHARING_STATUS = Object.freeze({
    PRIVATE: Object.freeze({ key: 'private', label: 'Private' }),
    PUBLISHED: Object.freeze({ key: 'published', label: 'Published' }),
    DEFAULT_PUBLISHED: Object.freeze({ key: 'default-published', label: 'Default Published' })
});

export function isNotePublished(note) {
    return Number(note?.is_published) === 1 && Boolean(note?.public_token);
}

export function isDefaultPublished(note, publicDefaultHashId) {
    return isNotePublished(note)
        && Boolean(publicDefaultHashId)
        && note?.hash_id === publicDefaultHashId;
}

export function getNoteSharingStatus(note, publicDefaultHashId) {
    if (isDefaultPublished(note, publicDefaultHashId)) {
        return SHARING_STATUS.DEFAULT_PUBLISHED;
    }
    if (isNotePublished(note)) {
        return SHARING_STATUS.PUBLISHED;
    }
    return SHARING_STATUS.PRIVATE;
}
