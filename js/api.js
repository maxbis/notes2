// API calls and response handling
import { API_ENDPOINT } from './state.js';

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
