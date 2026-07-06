# Import And Export

## Purpose

Document how notes are imported from Markdown and exported through the browser print-to-PDF flow.

## Location

- Markdown import flow: `/Users/maxbisschop/dev/www/notes2/js/markdown-import.js`
- PDF export flow: `/Users/maxbisschop/dev/www/notes2/js/pdf-export.js`
- App-level wiring: `/Users/maxbisschop/dev/www/notes2/app.js`

## Inputs/Outputs

- Inputs:
  - local `.md`, `.markdown`, and `.txt` files selected through the hidden file input
  - current editor HTML and title during export
- Outputs:
  - newly created notes from imported Markdown content
  - printable HTML opened in a print frame for PDF generation

## Flow/Behavior

1. The import button opens a hidden file input restricted to markdown-like file types.
2. When a file is selected:
   - the current dirty note is saved first when needed
   - the file content is read as text
   - Markdown is converted to HTML with `marked`
   - the imported note title defaults to the file basename
   - the frontend creates a new note through `POST`
   - notes are reloaded and the imported note is selected
3. The import flow detects obviously empty files and rejects them.
4. Export reads the current editor HTML and builds a dedicated print document.
5. The printable document applies export-specific styling for headings, tables, blockquotes, code, and indentation classes.
6. The export flow waits for images to load before invoking `window.print()`.

## Edge Cases/Failure Modes

- When the Markdown parser is unavailable:
  - import fails with a user-visible error

- When the selected file is empty:
  - import stops before note creation

- When the converted HTML has no meaningful content:
  - import fails rather than creating a blank note

- When the current note has no exportable content:
  - PDF export stops and alerts the user

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/markdown-import.js`
- `/Users/maxbisschop/dev/www/notes2/js/pdf-export.js`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/js/editor.js`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
