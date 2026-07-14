# Editor And Formatting

## Purpose

Explain how the note editor manages rich-text content, HTML mode, formatting controls, smart paste handling, and export-oriented content normalization.

## Location

- Editor HTML mode and serialization: `/Users/maxbisschop/dev/www/notes2/js/editor.js`
- Toolbar actions and caret-aware formatting: `/Users/maxbisschop/dev/www/notes2/js/toolbar.js`
- Simple insertion helpers: `/Users/maxbisschop/dev/www/notes2/js/insert.js`
- Paste sanitization and markdown-aware import logic: `/Users/maxbisschop/dev/www/notes2/js/smart-paste.js`
- PDF export rendering: `/Users/maxbisschop/dev/www/notes2/js/pdf-export.js`

## Inputs/Outputs

- Inputs:
  - user typing in the contenteditable editor
  - toolbar clicks and keyboard shortcuts
  - pasted HTML or markdown-like text
  - HTML mode edits in the raw textarea
  - export actions for printable output
- Outputs:
  - normalized editor HTML used by save and compare operations
  - formatted blocks, links, indentation classes, and inserted content
  - sanitized pasted markup
  - printable HTML used for browser PDF export

## Flow/Behavior

1. Rich-text mode uses the `#noteContent` contenteditable element as the primary editor surface.
2. HTML mode switches editing to a textarea while preserving a canonical raw HTML string in state.
3. `getEditorHtml()` returns:
   - the canonical raw HTML when HTML mode is active
   - the live `innerHTML` when rich-text mode is active
4. `formatHtmlForDisplay()` pretty-prints HTML for readability in HTML mode without changing the semantic content being saved.
5. The toolbar module applies inline formatting, headings, lists, indentation classes, block structure changes, links, and utility insertions.
   - on mobile layouts, typing a second consecutive space in rich-text prose replaces the two spaces with a full stop followed by one space
   - this shortcut is disabled in `pre` and `code` content and in HTML source mode
6. Smart paste examines pasted input before inserting it.
   - HTML is sanitized against a client allowlist
   - markdown-like text can be converted through the markdown import logic
   - unsafe tags, event handlers, inline styles, and unsafe links are removed
7. Insert helpers provide lightweight date and checkmark insertion at the current caret position.
8. PDF export builds a dedicated print document.
   - note content is sanitized for printable output
   - print-specific CSS styles headings, code, tables, blockquotes, and indentation classes
   - printing waits for images before calling `window.print()`

## Edge Cases/Failure Modes

- When the editor becomes visually empty:
  - toolbar logic restores a safe default block structure so Enter and block commands keep working

- When HTML mode text is reformatted:
  - display formatting can differ from the saved string
  - the app must preserve the canonical raw HTML to avoid false change detection

- When pasted content contains unsupported tags:
  - unsupported tags are unwrapped or removed
  - forbidden tags such as `script`, `style`, `iframe`, `svg`, and form controls are stripped

- When code block classes are present:
  - only `language-*` classes survive client paste sanitization

- When export content is empty:
  - PDF export stops early and alerts instead of generating a blank print document

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/editor.js`
- `/Users/maxbisschop/dev/www/notes2/js/toolbar.js`
- `/Users/maxbisschop/dev/www/notes2/js/insert.js`
- `/Users/maxbisschop/dev/www/notes2/js/smart-paste.js`
- `/Users/maxbisschop/dev/www/notes2/js/markdown-import.js`
- `/Users/maxbisschop/dev/www/notes2/js/pdf-export.js`
- `/Users/maxbisschop/dev/www/notes2/api/config.php`
- `/Users/maxbisschop/dev/www/notes2/api/sanitize.php`
