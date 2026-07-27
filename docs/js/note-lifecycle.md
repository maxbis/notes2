# Note Lifecycle

## Purpose

Document how notes are loaded, selected, created, updated, refreshed, and deleted across the main frontend state and save pipeline.

## Location

- Note list and selection behavior: `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- Note summary normalization: `/Users/maxbisschop/dev/www/notes2/js/note-summary.js`
- Save queue and conflict handling: `/Users/maxbisschop/dev/www/notes2/js/save.js`
- Shared frontend state: `/Users/maxbisschop/dev/www/notes2/js/state.js`
- App wiring: `/Users/maxbisschop/dev/www/notes2/app.js`
- Save deep-dive: `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`

## Inputs/Outputs

- Inputs:
  - metadata lists and selected-note payloads from `api.php`
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
   - The frontend requests up to 100 metadata summaries from `api.php?view=list`.
   - Sidebar state omits complete note content and stores server-generated previews.
   - Summaries are normalized so missing tags become `[]` and pin flags become `0` or `1`.
   - Summaries are sorted with pinned notes first and then by `updated_at` descending.

2. The app chooses an active note.
   - If the URL contains `?note=...`, the frontend requests that note directly.
   - Otherwise the first metadata summary is selected.
   - Selection fetches complete content from `api.php?id=...` before populating the editor.
   - While selection is loading, editor inputs are disabled.
   - A newer selection aborts the previous request and stale responses are ignored.
   - The selected note is also synced back into the URL.

3. Search and tag filters run on the server.
   - Search input is debounced for 250 milliseconds.
   - Search text and all active tags are sent to the metadata endpoint.
   - A newer query aborts the previous request and stale responses are ignored.
   - Clearing all filters returns immediately to the already loaded base summaries.

4. Editing changes local dirty state.
   - Title, rich-text content, HTML mode content, and tag edits all call `trackChanges()`.
   - Dirty state compares the current draft with `savedTitle`, `savedContent`, and `savedTags`.
   - New notes are only considered dirty when they contain meaningful content.

5. Saves are queued.
   - `saveNote()` coalesces overlapping save requests into a single queue runner.
   - Only one network save runs at a time.
   - Queued requests merge `showFeedback` and `forceOverwrite` flags instead of sending concurrent writes.

6. Create and update behavior diverge.
   - New notes use `POST` and are skipped when the draft is only the placeholder note.
   - Existing notes use `PUT` with `expected_version` for optimistic locking.
   - After a successful save, `currentNote` keeps the complete payload while sidebar collections receive normalized summaries.
   - Local ordering, timestamps, search results, and saved baseline fields are refreshed.

7. Conflict handling is explicit.
   - A `409 conflict` response opens a conflict dialog.
   - If the user cancels, the app refreshes from the server.
   - If the user chooses overwrite, the app retries with `force_overwrite`.

8. Freshness monitoring runs in the background.
   - The app checks note freshness on interval and on window focus.
   - If a newer server version exists and there are no local edits, the app refreshes immediately.
   - If local edits exist, the stale banner is shown instead.

9. Deletion removes the current note.
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

- When a note or search response arrives after a newer request:
  - the stale response is ignored
  - it cannot replace the editor or sidebar state selected by the newer action

- When the metadata endpoint reports more than 100 available summaries:
  - `notesHasMore` or `searchHasMore` records that more results exist
  - pagination remains a separate follow-up; the current sidebar shows the first 100

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- `/Users/maxbisschop/dev/www/notes2/js/note-summary.js`
- `/Users/maxbisschop/dev/www/notes2/js/save.js`
- `/Users/maxbisschop/dev/www/notes2/js/state.js`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/delete.php`
- `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`
