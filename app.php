<?php

// Validate user access
require_once __DIR__ . '/../zendure/login/validate.php';

?>


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Notes">
    <meta name="theme-color" content="#007aff">
    <title>Notes - Simple Note Taking</title>
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="icon" href="icons/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png">
    <!-- iOS Home Screen icon prefers PNG (180x180). -->
    <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1 class="app-title">
                <img class="app-logo" src="icons/favicon-32x32.png" alt="" aria-hidden="true">
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
                    <!-- Mobile: move headings/pre into overflow menu -->
                    <details class="overflow-menu mobile-only toolbar-overflow">
                        <summary class="overflow-menu-btn" aria-label="Headings / code" title="Headings / code">⋯</summary>
                        <div class="overflow-menu-panel">
                            <button class="overflow-menu-item" id="h1BtnMobile" type="button">H1</button>
                            <button class="overflow-menu-item" id="h2BtnMobile" type="button">H2</button>
                            <button class="overflow-menu-item" id="h3BtnMobile" type="button">H3</button>
                            <button class="overflow-menu-item" id="preBtnMobile" type="button">&lt;&gt;</button>
                            <hr class="overflow-menu-sep">
                            <button class="overflow-menu-item" id="htmlModeBtnMobile" type="button">HTML</button>
                            <button class="overflow-menu-item" id="insertDateBtnMobile" type="button">📅 Date</button>
                            <button class="overflow-menu-item" id="insertCheckmarkBtnMobile" type="button">✅ Check</button>
                        </div>
                    </details>

                    <div class="toolbar-group desktop-only" aria-label="Headings">
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
                    <span id="lastSaved" class="last-saved"></span>

                    <!-- Desktop: show Delete as a normal button -->
                    <div class="editor-actions desktop-only">
                        <button class="btn-secondary" id="shareLinkBtn" type="button" title="Copy public link" aria-label="Copy public link">Share</button>
                        <button class="btn-danger deleteBtn" type="button" title="Delete this note" aria-label="Delete this note">Delete</button>
                    </div>

                    <!-- Mobile: overflow menu -->
                    <details class="overflow-menu mobile-only">
                        <summary class="overflow-menu-btn" aria-label="More actions" title="More actions">⋯</summary>
                        <div class="overflow-menu-panel">
                            <button class="overflow-menu-item" id="shareLinkBtnMobile" type="button">Share (copy link)</button>
                            <hr class="overflow-menu-sep">
                            <button class="overflow-menu-item danger deleteBtn" type="button">Delete</button>
                        </div>
                    </details>
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

    <script src="vendor/beautify-html.min.js"></script>
    <script src="app.js"></script>
</body>
</html>
