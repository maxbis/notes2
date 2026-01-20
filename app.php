<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>Notes - Simple Note Taking</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="apple-touch-icon" href="favicon.svg">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1 class="app-title">
                <img class="app-logo" src="favicon.svg" alt="" aria-hidden="true">
                <span>Notes</span>
            </h1>
            <div class="header-actions">
                <button class="btn-secondary mobile-only" id="showNotesBtn" type="button" title="Search / Notes" aria-label="Search / Notes">🔍</button>
                <button class="btn-primary" id="newNoteBtn" type="button" title="Create a new note" aria-label="Create a new note">New</button>
            </div>
        </header>

        <div class="main-content">
            <aside class="sidebar">
                <div class="search-box">
                    <input type="text" id="searchInput" placeholder="Search notes...">
                </div>
                <div class="notes-list" id="notesList">
                    <!-- Notes will be loaded here -->
                </div>
            </aside>

            <main class="editor">
                <div class="editor-header">
                    <div class="title-container">
                        <span id="unsavedIndicator" class="unsaved-indicator" title="Unsaved changes"></span>
                        <input type="text" id="noteTitle" placeholder="Title...">
                    </div>
                </div>
                <div class="toolbar">
                    <button class="toolbar-btn" id="boldBtn" title="Bold (Ctrl+B)" aria-label="Bold">
                        <strong>B</strong>
                    </button>
                    <button class="toolbar-btn" id="italicBtn" title="Italic (Ctrl+I)" aria-label="Italic">
                        <em>I</em>
                    </button>
                    <button class="toolbar-btn" id="bulletListBtn" title="Bullet List" aria-label="Bullet list">
                        •
                    </button>
                    <button class="toolbar-btn" id="numberedListBtn" title="Numbered List" aria-label="Numbered list">
                        1.
                    </button>
                    <div class="toolbar-group" aria-label="Headings">
                        <button class="toolbar-btn" id="h1Btn" title="Heading 1" aria-label="Heading 1">H1</button>
                        <button class="toolbar-btn" id="h2Btn" title="Heading 2" aria-label="Heading 2">H2</button>
                        <button class="toolbar-btn" id="h3Btn" title="Heading 3" aria-label="Heading 3">H3</button>
                        <button class="toolbar-btn" id="preBtn" title="Preformatted (monospace)" aria-label="Preformatted (monospace)"><></button>
                    </div>
                    <button class="toolbar-btn" id="htmlModeBtn" title="Edit HTML" aria-label="Edit HTML">HTML</button>
                    <button class="toolbar-btn" id="insertDateBtn" title="Insert Date (;d)" aria-label="Insert date (shortcut ;d)">
                        📅
                    </button>
                    <button class="toolbar-btn" id="insertCheckmarkBtn" title="Insert Checkmark (;v)" aria-label="Insert checkmark (shortcut ;v)">
                        ✅
                    </button>
                </div>
                <div class="editor-content" id="noteContent" contenteditable="true" placeholder="Start writing your note..."></div>
                <textarea class="editor-content-html" id="noteContentHtml" hidden spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="Edit raw HTML..."></textarea>
                <div class="editor-footer">
                    <span id="noteMeta"></span>
                    <div class="editor-actions">
                        <button class="btn-danger" id="deleteBtn" type="button" title="Delete this note" aria-label="Delete this note">Delete</button>
                    </div>
                    <span id="lastSaved" class="last-saved"></span>
                </div>
            </main>
        </div>
    </div>

    <!-- Modern Dialog Modal -->
    <div id="modalOverlay" class="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-header">
                <h2 class="modal-title" id="modalTitle">Title</h2>
            </div>
            <div class="modal-body">
                <p id="modalMessage">Message</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="modalCancelBtn">Cancel</button>
                <button class="btn-primary" id="modalConfirmBtn">Confirm</button>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
