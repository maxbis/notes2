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
            <h1>📝 Notes</h1>
            <button class="btn-primary" id="newNoteBtn">New Note</button>
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
                    <div class="editor-actions">
                        <button class="btn-danger" id="deleteBtn">Delete</button>
                    </div>
                </div>
                <div class="toolbar">
                    <button class="toolbar-btn" id="boldBtn" title="Bold (Ctrl+B)">
                        <strong>B</strong>
                    </button>
                    <button class="toolbar-btn" id="italicBtn" title="Italic (Ctrl+I)">
                        <em>I</em>
                    </button>
                    <button class="toolbar-btn" id="bulletListBtn" title="Bullet List">
                        •
                    </button>
                    <button class="toolbar-btn" id="numberedListBtn" title="Numbered List">
                        1.
                    </button>
                    <button class="toolbar-btn" id="insertDateBtn" title="Insert Date">
                        📅
                    </button>
                    <button class="toolbar-btn" id="insertCheckmarkBtn" title="Insert Checkmark">
                        ✅
                    </button>
                </div>
                <div class="editor-content" id="noteContent" contenteditable="true" placeholder="Start writing your note..."></div>
                <div class="editor-footer">
                    <span id="noteMeta"></span>
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
