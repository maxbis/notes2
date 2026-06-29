<?php

// Validate user access
require_once __DIR__ . '/../zendure/login/validate.php';

?>


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            <div class="app-title-shell">
                <h1 class="app-title" aria-label="Notes">
                    <img class="app-logo" src="icons/favicon-32x32.png" alt="" aria-hidden="true">
                </h1>
                <div class="header-note-title">
                    <span id="unsavedIndicator" class="unsaved-indicator" title="Unsaved changes"></span>
                    <input type="text" id="noteTitle" placeholder="Title..." aria-label="Note title">
                </div>
            </div>
            <div class="header-actions">
                <div class="header-utility-actions">
                    <button class="btn-secondary mobile-only" id="showNotesBtn" type="button" title="Search / Notes" aria-label="Search / Notes">🔍</button>
                    <button class="btn-secondary" id="openLastModifiedBtn" type="button" title="Open last modified note" aria-label="Open last modified note">Recent</button>
                    <button class="btn-secondary reload-page-btn" id="reloadPageBtn" type="button" title="Reload page" aria-label="Reload page">
                        <span class="reload-page-btn-label">Reload</span>
                        <span class="reload-page-btn-icon" aria-hidden="true">↻</span>
                    </button>
                    <button class="btn-secondary" id="importMarkdownBtn" type="button" title="Import a Markdown file" aria-label="Import a Markdown file">Import MD</button>
                </div>
                <button class="btn-primary" id="newNoteBtn" type="button" title="Create a new note" aria-label="Create a new note">New</button>
                <input type="file" id="importMarkdownInput" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>
            </div>
        </header>

        <div class="main-content">
            <aside class="sidebar">
                <div class="search-box">
                    <input type="text" id="searchInput" placeholder="Search notes...">
                    <button type="button" id="clearSearchBtn" class="search-clear-btn" aria-label="Clear search" title="Clear search" hidden>&times;</button>
                </div>
                <div class="tag-filters" id="tagFilters" hidden></div>
                <div class="list-view-tabs" role="tablist" aria-label="List view">
                    <button type="button" class="list-view-tab" role="tab" data-view="all" aria-selected="false">ALL</button>
                    <button type="button" class="list-view-tab active" role="tab" data-view="groups" aria-selected="true">Groups</button>
                </div>
                <div class="notes-list" id="notesList">
                    <!-- Notes will be loaded here -->
                </div>
            </aside>

            <main class="editor">
                <div id="staleBanner" class="stale-banner" hidden>
                    <span>This note was updated elsewhere.</span>
                    <button type="button" class="stale-banner-refresh">Refresh</button>
                    <button type="button" class="stale-banner-dismiss">Dismiss</button>
                </div>
                <div class="editor-header">
                    <div class="tag-editor" id="tagEditor">
                        <div class="tag-editor-input">
                            <div class="tag-chips" id="tagChips"></div>
                            <input type="text" id="tagInput" class="tag-input" placeholder="Add tag...">
                        </div>
                    </div>
                </div>
                <div class="toolbar">
                    <div class="toolbar-group" aria-label="Inline formatting">
                        <button class="toolbar-btn" id="boldBtn" title="Bold (Ctrl+B)" aria-label="Bold">
                            <strong>B</strong>
                        </button>
                        <button class="toolbar-btn" id="italicBtn" title="Italic (Ctrl+I)" aria-label="Italic">
                            <em>I</em>
                        </button>
                        <button class="toolbar-btn" id="underlineBtn" title="Underline (Ctrl+U)" aria-label="Underline">
                            <u>U</u>
                        </button>
                    </div>
                    <div class="toolbar-group" aria-label="Structure and insertion">
                        <button class="toolbar-btn" id="bulletListBtn" title="Bullet List" aria-label="Bullet list">
                            •
                        </button>
                        <button class="toolbar-btn" id="numberedListBtn" title="Numbered List" aria-label="Numbered list">
                            1.
                        </button>
                        <button class="toolbar-btn" id="horizontalRuleBtn" title="Insert Horizontal Rule" aria-label="Insert horizontal rule">
                            ─
                        </button>
                        <button class="toolbar-btn" id="linkBtn" title="Insert Link" aria-label="Insert link">
                            🔗
                        </button>
                    </div>
                    <!-- Mobile: move headings/pre into overflow menu -->
                    <details class="overflow-menu mobile-only toolbar-overflow">
                        <summary class="overflow-menu-btn" aria-label="Headings / code" title="Headings / code">⋯</summary>
                        <div class="overflow-menu-panel">
                            <button class="overflow-menu-item" id="h1BtnMobile" type="button">H1</button>
                            <button class="overflow-menu-item" id="h2BtnMobile" type="button">H2</button>
                            <button class="overflow-menu-item" id="h3BtnMobile" type="button">H3</button>
                            <button class="overflow-menu-item" id="clearFormatBtnMobile" type="button">Clear</button>
                            <button class="overflow-menu-item" id="preBtnMobile" type="button">Code block</button>
                            <button class="overflow-menu-item" id="horizontalRuleBtnMobile" type="button">Divider</button>
                            <hr class="overflow-menu-sep">
                            <button class="overflow-menu-item" id="insertDateBtnMobile" type="button">📅 Date</button>
                            <button class="overflow-menu-item" id="insertCheckmarkBtnMobile" type="button">✅ Check</button>
                        </div>
                    </details>

                    <div class="toolbar-group desktop-only" aria-label="Headings and code">
                        <button class="toolbar-btn" id="h1Btn" title="Heading 1" aria-label="Heading 1">H1</button>
                        <button class="toolbar-btn" id="h2Btn" title="Heading 2" aria-label="Heading 2">H2</button>
                        <button class="toolbar-btn" id="h3Btn" title="Heading 3" aria-label="Heading 3">H3</button>
                        <button class="toolbar-btn" id="clearFormatBtn" title="Clear formatting" aria-label="Clear formatting">Tx</button>
                        <button class="toolbar-btn" id="preBtn" title="Preformatted (monospace)" aria-label="Preformatted (monospace)"><></button>
                    </div>
                    <div class="toolbar-group desktop-only toolbar-group-utility" aria-label="Utilities">
                        <button class="toolbar-btn" id="htmlModeBtn" title="Edit HTML" aria-label="Edit HTML">HTML</button>
                        <button class="toolbar-btn" id="insertDateBtn" title="Insert Date (;d)" aria-label="Insert date (shortcut ;d)">
                            📅
                        </button>
                        <button class="toolbar-btn" id="insertCheckmarkBtn" title="Insert Checkmark (;v)" aria-label="Insert checkmark (shortcut ;v)">
                            ✅
                        </button>
                    </div>
                </div>
                <div class="editor-body">
                    <div class="editor-main">
                        <div class="editor-content" id="noteContent" contenteditable="true" placeholder="Start writing your note..."></div>
                        <textarea class="editor-content-html" id="noteContentHtml" hidden spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="Edit raw HTML..."></textarea>
                        <div class="editor-footer">
                            <span id="noteMeta"></span>
                            <span id="lastSaved" class="last-saved"></span>

                            <!-- Desktop: show Delete as a normal button -->
                            <div class="editor-actions desktop-only">
                                <button class="btn-secondary" id="pinNoteBtn" type="button" title="Pin or unpin this note" aria-label="Pin or unpin this note">Pin</button>
                                <button class="btn-secondary" id="shareLinkBtn" type="button" title="Copy public link" aria-label="Copy public link">Share</button>
                                <button class="btn-secondary" id="editLinkBtn" type="button" title="Copy editable link" aria-label="Copy editable link">Edit link</button>
                                <button class="btn-secondary" id="exportPdfBtn" type="button" title="Export to PDF" aria-label="Export to PDF">PDF</button>
                                <button class="btn-danger deleteBtn" type="button" title="Delete this note" aria-label="Delete this note">Delete</button>
                            </div>

                            <!-- Mobile: overflow menu -->
                            <details class="overflow-menu mobile-only">
                                <summary class="overflow-menu-btn" aria-label="More actions" title="More actions">⋯</summary>
                                <div class="overflow-menu-panel">
                                    <button class="overflow-menu-item" id="pinNoteBtnMobile" type="button">Pin</button>
                                    <button class="overflow-menu-item" id="shareLinkBtnMobile" type="button">Share (copy link)</button>
                                    <button class="overflow-menu-item" id="editLinkBtnMobile" type="button">Edit link</button>
                                    <hr class="overflow-menu-sep">
                                    <button class="overflow-menu-item danger deleteBtn" type="button">Delete</button>
                                </div>
                            </details>
                        </div>
                    </div>
                    <aside class="inspector-panel" id="noteInspectorPanel" aria-label="Note inspector">
                        <div class="inspector-empty" id="noteInspectorEmpty">
                            <h3>Inspector</h3>
                            <p>Select a note to see stats, structure, tags, and quick actions here.</p>
                        </div>
                        <div class="inspector-content" id="noteInspectorContent" hidden>
                            <section class="inspector-section">
                                <div class="inspector-section-heading">Overview</div>
                                <div class="inspector-status-card">
                                    <div class="inspector-status-top">
                                        <span class="inspector-note-state" id="inspectorNoteState">Saved</span>
                                        <span class="inspector-pin-badge" id="inspectorPinBadge" hidden>Pinned</span>
                                    </div>
                                </div>
                            </section>

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Actions</div>
                                <div class="inspector-actions">
                                    <button class="btn-secondary inspector-action-btn" id="pinNoteBtnInspector" type="button">Pin</button>
                                    <button class="btn-secondary inspector-action-btn" id="shareLinkBtnInspector" type="button">Share</button>
                                    <button class="btn-secondary inspector-action-btn" id="editLinkBtnInspector" type="button">Edit link</button>
                                    <button class="btn-secondary inspector-action-btn" id="exportPdfBtnInspector" type="button">PDF</button>
                                    <button class="btn-danger inspector-action-btn inspector-action-danger deleteBtn" type="button">Delete</button>
                                </div>
                            </section>

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Outline</div>
                                <div class="inspector-outline" id="noteInspectorOutline"></div>
                            </section>

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Tags</div>
                                <div class="tag-editor tag-editor-inspector" id="tagEditorInspector">
                                    <div class="tag-chips tag-chips-inspector" id="tagChipsInspector"></div>
                                    <div class="tag-input-shell">
                                        <input type="text" id="tagInputInspector" class="tag-input" placeholder="Add tag...">
                                    </div>
                                </div>
                            </section>

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Stats</div>
                                <div class="inspector-stats-grid">
                                    <div class="inspector-stat-card">
                                        <span class="inspector-stat-label">Words</span>
                                        <strong id="inspectorWordCount">0</strong>
                                    </div>
                                    <div class="inspector-stat-card">
                                        <span class="inspector-stat-label">Reading</span>
                                        <strong id="inspectorReadingTime">0 min</strong>
                                    </div>
                                    <div class="inspector-stat-card inspector-stat-card-muted">
                                        <span class="inspector-stat-label">Chars</span>
                                        <strong id="inspectorCharCount">0</strong>
                                    </div>
                                    <div class="inspector-stat-card">
                                        <span class="inspector-stat-label">Sections</span>
                                        <strong id="inspectorHeadingCount">0</strong>
                                    </div>
                                </div>
                            </section>

                            <section class="inspector-section inspector-section-secondary">
                                <div class="inspector-section-heading">Timeline</div>
                                <dl class="inspector-meta-list">
                                    <div class="inspector-meta-row">
                                        <dt>Created</dt>
                                        <dd id="inspectorCreatedAt">-</dd>
                                    </div>
                                    <div class="inspector-meta-row">
                                        <dt>Updated</dt>
                                        <dd id="inspectorUpdatedAt">-</dd>
                                    </div>
                                </dl>
                                <div class="inspector-meta-inline">Version <span id="inspectorVersion">-</span></div>
                            </section>
                        </div>
                    </aside>
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

    <!-- Link Dialog Modal -->
    <div id="linkModalOverlay" class="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-header">
                <h2 class="modal-title">Insert Link</h2>
            </div>
            <div class="modal-body">
                <div class="link-dialog-form">
                    <div class="link-dialog-field">
                        <label for="linkModalTitleInput">Title</label>
                        <input type="text" id="linkModalTitleInput" placeholder="Link text" autocomplete="off">
                    </div>
                    <div class="link-dialog-field">
                        <label for="linkModalUrlInput">URL</label>
                        <input type="url" id="linkModalUrlInput" placeholder="https://example.com" autocomplete="off">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="linkModalCancelBtn">Cancel</button>
                <button class="btn-primary" id="linkModalInsertBtn">Insert</button>
            </div>
        </div>
    </div>

    <script src="vendor/beautify-html.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script type="module" src="app.js"></script>

</body>
</html>
