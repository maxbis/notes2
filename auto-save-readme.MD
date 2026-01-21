# Auto-save + Conflict Handling (Version-Based)

This app uses **auto-save** plus **optimistic locking** (a per-note integer `version`) to prevent silent overwrites when the same note is edited in multiple sessions/devices.

The key design goals are:

- **No data loss**: detect when the server changed since your last known save.
- **No “self-conflicts”**: one browser tab should not conflict with itself due to overlapping saves.
- **Fast typing UX**: saves happen after a short pause (debounce), not on every keystroke.

---

## Server-side model (what makes conflicts detectable)

Each note row has a numeric `version`:

- **On every update**, the server increments `version` (`version = version + 1`).
- The client must send `expected_version` (the version it last loaded/saved).
- The server only applies the update if `expected_version` still matches the current row.

If the version mismatches, the API returns **HTTP 409 Conflict** with:

- `server_version`
- `expected_version`
- `behind_by = server_version - expected_version` (minimum 0)

This is the core “optimistic locking” mechanism.

---

## Client-side state

The UI keeps a few important pieces of state:

- **`hasUnsavedChanges`**: whether the editor differs from the last saved content.
- **`savedTitle` / `savedContent`**: last saved values (used to detect changes).
- **`originalVersion`**: the last known server `version` for the currently loaded note.
- **Auto-save timer**: a debounce timer started after edits.
- **Save queue/runner**: ensures only one save runs at a time.

---

## Auto-save algorithm (debounce + serialized saves)

### 1) Debounce on edits

When the user edits the title/content:

- We mark the note “dirty” (`hasUnsavedChanges = true`).
- We clear any previous timer.
- We start a timer (currently ~4 seconds) and only save when the user pauses typing.

This avoids sending a request for every keystroke.

### 2) Serialize saves (prevents self-conflicts)

Even with a debounce, it’s possible to trigger multiple saves quickly (e.g., typing + clicking save indicator, or repeated edits while a save request is still in-flight).

With optimistic locking, **two overlapping PUTs from the same tab** can create a “self-conflict”:

- Request A and B both send the same `expected_version`.
- A completes first and bumps `version`.
- B arrives next, `expected_version` is stale → server returns 409.

To prevent this, **the client never allows overlapping saves**:

- `saveNote()` does not necessarily perform the network request immediately.
- Instead, `saveNote()` marks “save pending” and starts (or joins) a **single save runner**.
- The save runner executes saves **one at a time**.
- If another save is requested while one is running, it is **queued/coalesced** and runs right after the current save finishes.

Result: the client always sends `expected_version` based on the most recent completed save, avoiding self-conflicts.

---

## Save request details

For an existing note, the client sends:

```json
{
  "hash_id": "…",
  "title": "…",
  "content": "…",
  "expected_version": 12,
  "force_overwrite": false
}
```

On success, the server returns the updated note including the new `version`. The client then updates:

- `savedTitle` / `savedContent`
- `hasUnsavedChanges = false`
- `originalVersion = savedNote.version`

---

## Conflict algorithm (HTTP 409 + dialog)

### When a conflict happens

A conflict happens when:

- Another session/device saved the note first, and
- The current client tries to save with an older `expected_version`.

The server responds with **409** and includes how many versions you’re behind (`behind_by`).

### UI behavior (existing dialog)

When the client receives 409:

- It shows the existing **“Conflict Detected”** dialog.
- It offers:
  - **Cancel & Refresh**: reload the note from the server (discard local edits).
  - **Overwrite**: explicitly force an overwrite.

### Overwrite behavior (with copy/backup)

If the user chooses **Overwrite**:

- The client retries the PUT with `force_overwrite: true`.
- The server will:
  - **Only if you are behind** (`server_version > expected_version`), create a copy of the current server note with title suffix:
    - `"(version overwritten)"`
  - Then overwrite the original note and bump its `version`.

This provides a safety net: the overwritten server state remains available as a separate note.

---

## Why we do NOT reload the whole page after overwrite

A full page reload is usually unnecessary and can be disruptive (focus/caret resets, layout changes).

Correctness comes from:

- Updating `originalVersion` to the newly saved version, and
- Refreshing the note content/state as needed.

If you want the newly created “(version overwritten)” copy to appear immediately in the sidebar, the UI can refresh the notes list (e.g., re-fetch the list) after an overwrite save completes. This is lighter than a full page reload.

---

## Known edge cases / notes

- **Save-before-unload** (`keepalive` PUT) also sends `expected_version`. If it races with a normal save, the queue/runner approach helps reduce overlaps while the page is active, but unload behavior depends on browser timing.
- **Any other writer** (another device, another tab, or background process) can still legitimately cause 409 conflicts. Serialization only prevents “self-conflicts.”

