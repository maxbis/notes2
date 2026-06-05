# Save Behavior

## Purpose

Describe how note saves work during normal editing, context switches, and page exit so concurrency behavior is predictable and duplicate saves are easier to reason about.

## Location

- Main event wiring: `/Users/maxbisschop/dev/www/notes2/app.js`
- Save queue and unload fallback: `/Users/maxbisschop/dev/www/notes2/js/save.js`
- Note selection and new-note flow: `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- Server-side update semantics: `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`

## Inputs/Outputs

- Inputs:
  - editor changes in title or content
  - tab visibility changes
  - page unload
- Outputs:
  - serialized `POST` create requests for new notes
  - serialized `PUT` update requests for existing notes
  - last-resort unload save attempts during page exit

## Flow/Behavior

1. Normal editing uses debounced auto-save.
   - When title or content changes, the note becomes dirty.
   - The app clears any existing timer.
   - A new timer is started for `AUTO_SAVE_DELAY_MS` (currently 4 seconds).
   - If the note is still dirty when that timer fires, the app calls the normal queued `saveNote(false)` path.

2. Normal saves are serialized.
   - `saveNote()` does not allow overlapping network saves.
   - If a save is already running, later save requests are coalesced and run after the current save completes.
   - This is the main protection against self-conflicts inside one tab.

3. Switching away from the tab flushes dirty work through the normal save queue.
   - When `document.hidden` becomes `true`, the app clears the debounce timer.
   - If the note is dirty, it immediately calls `saveNote(false)`.
   - This is intended for common context switches like changing tabs or switching apps.

4. Page exit still has a last-resort unload fallback.
   - On `beforeunload`, the app still calls `saveBeforeUnload()`.
   - This path exists only as a best-effort fallback for true page leave/close timing.

5. Window `blur` no longer triggers saves.
   - Losing focus alone is too noisy and caused extra concurrent save paths.
   - Examples include DevTools focus, app switching, or short-lived focus changes inside the browser.

## Edge Cases/Failure Modes

- When the user switches context before the 4-second debounce finishes:
  - the dirty note is saved immediately on `visibilitychange`
  - this avoids waiting for idle time in common tab-switch cases

- When the browser is closing very quickly:
  - the queued save triggered by `visibilitychange` may not finish in time
  - `beforeunload` remains as a fallback, but unload timing is browser-dependent

- When another session updates the same note:
  - the normal save path still uses optimistic locking with `expected_version`
  - conflict handling continues to happen in the normal queued save flow

- When a new note has not been created yet:
  - the normal path should create it through the standard queued save flow
  - unload behavior remains a best-effort fallback, not the primary creation mechanism

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/state.js`
- `/Users/maxbisschop/dev/www/notes2/js/indicators.js`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/auto-save-readme.MD`
