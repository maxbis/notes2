// Editor HTML management and HTML mode handling
import state from './state.js';

export function getEditorHtml() {
    if (state.isHtmlMode) {
        // IMPORTANT: return the canonical (unformatted) HTML string.
        // The textarea may contain a pretty-printed display version.
        if (typeof state.htmlModeRawHtml === 'string') return state.htmlModeRawHtml;
        const htmlEl = document.getElementById('noteContentHtml');
        return htmlEl ? htmlEl.value : '';
    }
    const editor = document.getElementById('noteContent');
    return editor ? editor.innerHTML : '';
}

export function formatHtmlForDisplay(html) {
    const input = String(html ?? '');
    try {
        // `vendor/beautify-html.min.js` provides a global `html_beautify` function.
        if (typeof html_beautify === 'function') {
            return html_beautify(input, {
                indent_size: 2,
                indent_char: ' ',
                unformatted: ['pre', 'code']
            });
        }
    } catch { /* ignore */ }
    return input;
}

// Empty editor content: use a single <p> so Enter and block behavior work (contenteditable needs a block).
const EMPTY_EDITOR_HTML = '<p><br></p>';

export function setEditorHtml(html) {
    const editor = document.getElementById('noteContent');
    const htmlEl = document.getElementById('noteContentHtml');
    const raw = String(html ?? '').trim();
    state.htmlModeRawHtml = raw === '' ? EMPTY_EDITOR_HTML : raw;
    state.htmlModeDirty = false;

    if (editor) editor.innerHTML = state.htmlModeRawHtml;
    if (htmlEl) {
        htmlEl.value = state.isHtmlMode ? formatHtmlForDisplay(state.htmlModeRawHtml) : state.htmlModeRawHtml;
    }
}

export function setHtmlMode(enabled) {
    state.isHtmlMode = !!enabled;
    const editor = document.getElementById('noteContent');
    const htmlEl = document.getElementById('noteContentHtml');
    const btn = document.getElementById('htmlModeBtn');
    const btnMobile = document.getElementById('htmlModeBtnMobile');
    if (!editor || !htmlEl || !btn) return;

    if (state.isHtmlMode) {
        state.htmlModeDirty = false;
        state.htmlModeRawHtml = editor.innerHTML;
        htmlEl.value = formatHtmlForDisplay(state.htmlModeRawHtml);
        htmlEl.hidden = false;
        editor.hidden = true;
        btn.classList.add('active');
        if (btnMobile) btnMobile.classList.add('active');
        htmlEl.focus();
    } else {
        // If the user edited the textarea, `htmlModeRawHtml` is updated on input.
        // If they did not, keep the original raw HTML (not the formatted display string).
        editor.innerHTML = state.htmlModeRawHtml;
        editor.hidden = false;
        htmlEl.hidden = true;
        btn.classList.remove('active');
        if (btnMobile) btnMobile.classList.remove('active');
        editor.focus();
    }
}
