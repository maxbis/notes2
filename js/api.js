// API calls and response handling
import { API_ENDPOINT } from './state.js';

/**
 * Set or clear the public "easy access" default note (redirect when visiting public.php without ?id=).
 * @param {string|null} hashId - Note hash_id to set as default, or null to clear.
 */
export async function setPublicDefault(hashId) {
    const response = await fetch(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_public_default: hashId })
    });
    const data = await readJsonResponse(response, 'setPublicDefault');
    if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
}

export async function readJsonResponse(response, context = 'request') {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        const snippet = text.slice(0, 300);
        const err = new Error(`[${context}] Expected JSON but got: ${snippet}`);
        err.cause = e;
        err.status = response.status;
        throw err;
    }
}
