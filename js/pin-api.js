import { API_ENDPOINT } from './state.js';

async function readPinnedJsonResponse(response, context = 'request') {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        const snippet = text.slice(0, 300);
        const parseError = new Error(`[${context}] Expected JSON but got: ${snippet}`);
        parseError.cause = error;
        parseError.status = response.status;
        throw parseError;
    }
}

export async function setPinned(hashId, isPinned) {
    const response = await fetch(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            set_pinned: {
                hash_id: hashId,
                is_pinned: isPinned
            }
        })
    });
    const data = await readPinnedJsonResponse(response, 'setPinned');
    if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
}
