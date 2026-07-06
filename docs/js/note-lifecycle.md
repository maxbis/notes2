# Note Lifecycle

## Purpose

Document how notes are loaded, selected, created, updated, refreshed, and deleted across the main frontend state and save pipeline.

## Location

- Note list and selection behavior: `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- Save queue and conflict handling: `/Users/maxbisschop/dev/www/notes2/js/save.js`
- Shared frontend state: `/Users/maxbisschop/dev/www/notes2/js/state.js`
- App wiring: `/Users/maxbisschop/dev/www/notes2/app.js`
- Save deep-dive: `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`

## Inputs/Outputs

- Inputs:
  - loaded note payloads from `api.php`
  - title, content, and tag edits from the editor
  - note selection, create, delete, and refresh actions
  - visibility and focus changes used for freshness checks and save triggers
- Outputs:
  - rendered note list with search, grouping, and pin-aware ordering
  - serialized create and update requests
  - refreshed local state after saves, conflicts, or remote changes
  - stale-banner prompts when the server version changes elsewhere

## Flow/Behavior

1. App startup calls `loadNotes()`.
   - The frontend requests all notes from `api.php`.
   - Notes are normalized so missing tags become `[]` and pin flags become `0` or `1`.
   - Notes are sorted with pinned notes first and then by `updated_at` descending.

2. The app chooses an active note.
   - If the URL contains `?note=...` and that note exists, it is selected.
   - Otherwise the first loaded note is selected.
   - The selected note is also synced back into the URL.

3. Editing changes local dirty state.
   - Title, rich-text content, HTML mode content, and tag edits all call `trackChanges()`.
   - Dirty state compares the current draft with `savedTitle`, `savedContent`, and `savedTags`.
   - New notes are only considered dirty when they contain meaningful content.

4. Saves are queued.
   - `saveNote()` coalesces overlapping save requests into a single queue runner.
   - Only one network save runs at a time.
   - Queued requests merge `showFeedback` and `forceOverwrite` flags instead of sending concurrent writes.

5. Create and update behavior diverge.
   - New notes use `POST` and are skipped when the draft is only the placeholder note.
   - Existing notes use `PUT` with `expected_version` for optimistic locking.
   - After a successful save, local state, note ordering, timestamps, and saved baseline fields are refreshed.

6. Conflict handling is explicit.
   - A `409 conflict` response opens a conflict dialog.
   - If the user cancels, the app refreshes from the server.
   - If the user chooses overwrite, the app retries with `force_overwrite`.

7. Freshness monitoring runs in the background.
   - The app checks note freshness on interval and on window focus.
   - If a newer server version exists and there are no local edits, the app refreshes immediately.
   - If local edits exist, the stale banner is shown instead.

8. Deletion removes the current note.
   - Delete actions are confirmed before sending the delete request.
   - The local note list is updated after successful deletion.
   - Selection moves to another available note when possible.

## Edge Cases/Failure Modes

- When the current draft is only the placeholder:
  - create is skipped intentionally
  - the app avoids filling the database with empty notes

- When multiple save triggers happen close together:
  - the queue prevents overlapping requests from generating self-conflicts

- When the server version changes during editing:
  - the stale banner warns the user before local changes are silently replaced

- When local storage is unavailable:
  - group expansion state and list-view preference persistence fail quietly
  - core note behavior still works

- When API responses are malformed or non-JSON:
  - the JSON reader throws
  - the app logs errors and falls back to existing UI state rather than partially updating with bad data

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- `/Users/maxbisschop/dev/www/notes2/js/save.js`
- `/Users/maxbisschop/dev/www/notes2/js/state.js`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/delete.php`
- `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`
