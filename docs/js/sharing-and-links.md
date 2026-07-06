# Sharing And Links

## Purpose

Describe how public links, editable links, pinning, and the public easy-access default are managed from the frontend.

## Location

- Top-level share and pin actions: `/Users/maxbisschop/dev/www/notes2/app.js`
- Link and API helpers: `/Users/maxbisschop/dev/www/notes2/js/api.js`
- Pin update helper: `/Users/maxbisschop/dev/www/notes2/js/pin-api.js`
- URL helpers: `/Users/maxbisschop/dev/www/notes2/js/utils.js`
- Public rendering target: `/Users/maxbisschop/dev/www/notes2/public.php`

## Inputs/Outputs

- Inputs:
  - current selected note and dirty state
  - share, edit-link, and pin button clicks
  - clipboard API availability
- Outputs:
  - copied public links to `public.php?id=...`
  - copied editable links to `app.php?note=...`
  - pin state updates
  - public easy-access default updates

## Flow/Behavior

1. Share actions require a real note.
   - if the draft is new and meaningful, the app saves it first
   - if the draft is empty, sharing is blocked with a user-facing message
2. Public links are built with `getPublicLink(hashId)`.
3. Editable links are built with `getEditorLink(hashId)`.
4. When unsaved changes exist on an existing note:
   - the app saves first so the shared or editable link reflects the current visible content
5. If clipboard write succeeds:
   - the share dialog confirms the copied link
   - the public-link dialog also exposes the easy-access default toggle
6. If clipboard write fails:
   - the app falls back to `window.prompt()` so the user can copy the URL manually
7. Pin actions call a dedicated `PUT` API branch and then refresh the local note state with the returned note payload.

## Edge Cases/Failure Modes

- When a note has not been created yet:
  - links cannot be generated until a save returns a `hash_id`

- When clipboard APIs are unavailable:
  - link generation still works through manual prompt fallback

- When the user toggles easy access:
  - only the public default setting changes
  - the current note content itself is not modified

- When pin state changes:
  - the note version is bumped on the server, so pinning participates in freshness and conflict-aware flows

## Related Files

- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/js/api.js`
- `/Users/maxbisschop/dev/www/notes2/js/pin-api.js`
- `/Users/maxbisschop/dev/www/notes2/js/utils.js`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
- `/Users/maxbisschop/dev/www/notes2/public.php`
