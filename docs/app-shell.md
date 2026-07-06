# App Shell

## Purpose

Describe the authenticated Notes application shell, its major screen regions, how the frontend boots, and which user actions are wired at the top level.

## Location

- Main shell markup: `/Users/maxbisschop/dev/www/notes2/app.php`
- Frontend bootstrap and event wiring: `/Users/maxbisschop/dev/www/notes2/app.js`
- Shared visual shell styles: `/Users/maxbisschop/dev/www/notes2/style.css`
- Web app manifest: `/Users/maxbisschop/dev/www/notes2/manifest.webmanifest`

## Inputs/Outputs

- Inputs:
  - authenticated requests to `app.php`
  - DOM events from header buttons, sidebar controls, editor fields, and window lifecycle events
  - query parameter `?note=...` for direct note opening
- Outputs:
  - the full editor interface for notes
  - module initialization for loading, editing, saving, sharing, pinning, import, export, and inspector features
  - responsive desktop and mobile shell behavior

## Flow/Behavior

1. `app.php` performs access validation before rendering the app shell.
2. The HTML defines four main UI areas:
   - the header with create, recent, reload, and import actions
   - the sidebar with search, tag filters, list mode tabs, and the note list
   - the editor pane with title, tags, toolbar, rich-text editor, HTML mode textarea, and footer actions
   - the inspector pane with tags, outline, actions, and metadata
3. `app.js` imports the feature modules from `js/` and exposes `window.selectNote` so rendered note list markup can trigger note selection.
4. On `DOMContentLoaded`, the app initializes toolbar, notes, save flow, markdown import, smart paste, and list-view state.
5. The app loads notes from `api.php`, selects the requested note if `?note=` matches an existing note, otherwise selects the first available note.
6. Event listeners are attached for:
   - create, delete, reload, recent, share, edit-link, pin, and PDF actions
   - search input and clear button behavior
   - HTML mode toggle and format action
   - stale-banner refresh and dismiss actions
   - visibility, focus, resize, and beforeunload lifecycle handling
7. On mobile layouts, the shell switches between sidebar/search mode and editor mode by adding and removing body classes.

## Edge Cases/Failure Modes

- When there are no notes yet:
  - the editor shell still loads
  - selection depends on later create flow rather than initial note load

- When a requested `?note=` value does not exist:
  - the app falls back to the first loaded note instead of staying on a broken selection

- When the user edits content in HTML mode:
  - the app must keep the formatted textarea display separate from the canonical raw HTML string to avoid false dirty-state detection

- When the app is used on mobile:
  - focus and pointer events intentionally hide the sidebar so the editor gets the full viewport
  - the search button becomes a mode toggle rather than a simple action

- When unsaved changes exist during tab switches or page exit:
  - shell-level listeners delegate to the save flow rather than trying to directly write data themselves

## Related Files

- `/Users/maxbisschop/dev/www/notes2/index.php`
- `/Users/maxbisschop/dev/www/notes2/app.php`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/style.css`
- `/Users/maxbisschop/dev/www/notes2/manifest.webmanifest`
- `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- `/Users/maxbisschop/dev/www/notes2/js/save.js`
- `/Users/maxbisschop/dev/www/notes2/js/editor.js`
