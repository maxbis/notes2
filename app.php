<?php

// Validate user access (shared-key cookie gate)
require_once __DIR__ . '/login/validate.php';

$warmPaperVersion = (string) filemtime(__DIR__ . '/warm-paper/warm-paper.css');
$styleVersion = (string) filemtime(__DIR__ . '/style.css');

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Notes">
    <meta name="theme-color" content="#315f8d">
    <title>Notes - Simple Note Taking</title>
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="icon" href="icons/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png">
    <!-- iOS Home Screen icon prefers PNG (180x180). -->
    <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
    <link rel="stylesheet" href="warm-paper/warm-paper.css?v=<?php echo rawurlencode($warmPaperVersion); ?>">
    <link rel="stylesheet" href="style.css?v=<?php echo rawurlencode($styleVersion); ?>">
</head>
<body class="wp-theme">
    <div class="container wp-app">
        <header class="wp-header">
            <div class="app-title-shell">
                <h1 class="app-title" aria-label="Notes">
                    <img class="app-logo" src="icons/favicon-32x32.png" alt="" aria-hidden="true">
                </h1>
                <div class="app-brand">
                    <span class="app-name">Notes</span>
                </div>
            </div>
            <div class="header-actions">
                <div class="header-utility-actions">
                    <button class="btn-secondary wp-button wp-button--secondary mobile-only" id="showNotesBtn" type="button" title="Search / Notes" aria-label="Search / Notes">🔍</button>
                    <button class="btn-secondary wp-button wp-button--secondary" id="openLastModifiedBtn" type="button" title="Open last modified note" aria-label="Open last modified note">Recent</button>
                    <button class="btn-secondary wp-button wp-button--secondary reload-page-btn" id="reloadPageBtn" type="button" title="Reload page" aria-label="Reload page">
                        <span class="reload-page-btn-label">↺ Reload</span>
                        <span class="reload-page-btn-icon" aria-hidden="true">↻</span>
                    </button>
                    <button class="btn-secondary wp-button wp-button--secondary" id="importMarkdownBtn" type="button" title="Import a Markdown file" aria-label="Import a Markdown file">Import MD</button>
                </div>
                <button class="btn-primary wp-button wp-button--primary" id="newNoteBtn" type="button" title="Create a new note" aria-label="Create a new note">+ New</button>
                <input type="file" id="importMarkdownInput" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>
            </div>
        </header>

        <div class="main-content">
            <aside class="sidebar">
                <div class="search-box wp-search">
                    <input class="wp-input" type="text" id="searchInput" placeholder="Search notes..." aria-label="Search notes">
                    <button type="button" id="clearSearchBtn" class="search-clear-btn wp-icon-button" aria-label="Clear search" title="Clear search" hidden>&times;</button>
                </div>
                <div class="tag-filters" id="tagFilters" hidden></div>
                <div class="list-view-tabs" role="tablist" aria-label="List view">
                    <button type="button" class="list-view-tab wp-button wp-button--quiet" role="tab" data-view="all" aria-selected="false">ALL</button>
                    <button type="button" class="list-view-tab wp-button wp-button--quiet active" role="tab" data-view="groups" aria-selected="true">Groups</button>
                </div>
                <div class="notes-list" id="notesList">
                    <!-- Notes will be loaded here -->
                </div>
            </aside>

            <main class="editor">
                <div id="staleBanner" class="stale-banner wp-alert wp-alert--warning" role="status" hidden>
                    <span>This note was updated elsewhere.</span>
                    <button type="button" class="stale-banner-refresh wp-button wp-button--primary">Refresh</button>
                    <button type="button" class="stale-banner-dismiss wp-button wp-button--quiet">Dismiss</button>
                </div>
                <div class="editor-header">
                    <div class="editor-title-shell">
                        <span id="unsavedIndicator" class="unsaved-indicator" title="Unsaved changes"></span>
                        <input type="text" id="noteTitle" placeholder="Untitled note" aria-label="Note title">
                    </div>
                    <div class="tag-editor" id="tagEditor">
                        <div class="tag-editor-input">
                            <div class="tag-chips" id="tagChips"></div>
                            <input type="text" id="tagInput" class="tag-input" placeholder="Add tag...">
                        </div>
                    </div>
                </div>
                <div class="toolbar" role="toolbar" aria-label="Note formatting">
                    <div class="toolbar-group" role="group" aria-label="Inline formatting">
                        <button class="toolbar-btn wp-icon-button" id="boldBtn" title="Bold (Ctrl/Cmd+B)" aria-label="Bold">
                            <strong>B</strong>
                        </button>
                        <button class="toolbar-btn wp-icon-button" id="italicBtn" title="Italic (Ctrl/Cmd+I)" aria-label="Italic">
                            <em>I</em>
                        </button>
                        <button class="toolbar-btn wp-icon-button" id="underlineBtn" title="Underline (Ctrl/Cmd+U)" aria-label="Underline">
                            <u>U</u>
                        </button>
                    </div>
                    <div class="toolbar-group" role="group" aria-label="Lists and indentation">
                        <button class="toolbar-btn wp-icon-button" id="bulletListBtn" title="Bullet List (;b)" aria-label="Bullet list">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 6h11M9 12h11M9 18h11"/>
                                <circle cx="4" cy="6" r="1"/>
                                <circle cx="4" cy="12" r="1"/>
                                <circle cx="4" cy="18" r="1"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button" id="numberedListBtn" title="Numbered List (;n)" aria-label="Numbered list">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 6h10M10 12h10M10 18h10M3 5h2v4M3 14h2l-2 4h2"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button mobile-toolbar-hidden" id="outdentBtn" title="Outdent list item (Shift+Tab)" aria-label="Outdent list item">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 6h10M10 12h10M10 18h10M3 12h5M6 9l-3 3 3 3"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button mobile-toolbar-hidden" id="indentBtn" title="Indent list item (Tab)" aria-label="Indent list item">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 6h10M10 12h10M10 18h10M3 12h5M5 9l3 3-3 3"/>
                            </svg>
                        </button>
                    </div>

                    <div class="toolbar-group desktop-only" role="group" aria-label="Headings and code">
                        <button class="toolbar-btn wp-icon-button" id="h1Btn" title="Heading 1 (;1)" aria-label="Heading 1">H1</button>
                        <button class="toolbar-btn wp-icon-button" id="h2Btn" title="Heading 2 (;2)" aria-label="Heading 2">H2</button>
                        <button class="toolbar-btn wp-icon-button" id="h3Btn" title="Heading 3 (;3)" aria-label="Heading 3">H3</button>
                        <button class="toolbar-btn wp-icon-button" id="clearFormatBtn" title="Clear formatting (;0)" aria-label="Clear formatting">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m15 4 5 5-9 9H6l-3-3L15 4Z"/>
                                <path d="m10 9 5 5M6 18h15"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button" id="preBtn" title="Code block (;c)" aria-label="Code block">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="16" rx="2"/>
                                <path d="m9 9-3 3 3 3M15 9l3 3-3 3"/>
                            </svg>
                        </button>
                    </div>

                    <div class="toolbar-group mobile-toolbar-hidden" role="group" aria-label="Insert">
                        <button class="toolbar-btn wp-icon-button" id="horizontalRuleBtn" title="Insert Horizontal Rule" aria-label="Insert horizontal rule">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 16h16M12 4v7M8.5 7.5h7"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button" id="linkBtn" title="Insert Link" aria-label="Insert link">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/>
                                <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button desktop-only" id="insertDateBtn" title="Insert Date (;d)" aria-label="Insert date (shortcut ;d)">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                            </svg>
                        </button>
                        <button class="toolbar-btn wp-icon-button desktop-only" id="insertCheckmarkBtn" title="Insert Checkmark (;v)" aria-label="Insert checkmark (shortcut ;v)">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="18" height="18" rx="3"/>
                                <path d="m7 12 3 3 7-7"/>
                            </svg>
                        </button>
                    </div>
                    <details class="overflow-menu mobile-only toolbar-overflow">
                        <summary class="overflow-menu-btn wp-icon-button" aria-label="Headings / code" title="Headings / code">⋯</summary>
                        <div class="overflow-menu-panel wp-menu">
                            <button class="overflow-menu-item wp-menu__item" id="h1BtnMobile" type="button" title="Heading 1 (;1)">H1</button>
                            <button class="overflow-menu-item wp-menu__item" id="h2BtnMobile" type="button" title="Heading 2 (;2)">H2</button>
                            <button class="overflow-menu-item wp-menu__item" id="h3BtnMobile" type="button" title="Heading 3 (;3)">H3</button>
                            <button class="overflow-menu-item wp-menu__item" id="clearFormatBtnMobile" type="button" title="Clear formatting (;0)">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="m15 4 5 5-9 9H6l-3-3L15 4Z"/>
                                    <path d="m10 9 5 5M6 18h15"/>
                                </svg>
                                <span>Clear formatting</span>
                            </button>
                            <button class="overflow-menu-item wp-menu__item" id="preBtnMobile" type="button" title="Code block (;c)">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                                    <path d="m9 9-3 3 3 3M15 9l3 3-3 3"/>
                                </svg>
                                <span>Code block</span>
                            </button>
                            <button class="overflow-menu-item wp-menu__item" id="outdentBtnMobile" type="button" title="Outdent list item (Shift+Tab)">Outdent</button>
                            <button class="overflow-menu-item wp-menu__item" id="indentBtnMobile" type="button" title="Indent list item (Tab)">Indent</button>
                            <hr class="overflow-menu-sep wp-menu__separator">
                            <button class="overflow-menu-item wp-menu__item" id="linkBtnMobile" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/>
                                    <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>
                                </svg>
                                <span>Insert link</span>
                            </button>
                            <button class="overflow-menu-item wp-menu__item" id="horizontalRuleBtnMobile" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 16h16M12 4v7M8.5 7.5h7"/>
                                </svg>
                                <span>Insert divider</span>
                            </button>
                            <button class="overflow-menu-item wp-menu__item" id="insertDateBtnMobile" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="3" y="5" width="18" height="16" rx="2"/>
                                    <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                                </svg>
                                <span>Insert date</span>
                            </button>
                            <button class="overflow-menu-item wp-menu__item" id="insertCheckmarkBtnMobile" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                                    <path d="m7 12 3 3 7-7"/>
                                </svg>
                                <span>Insert checkmark</span>
                            </button>
                        </div>
                    </details>

                    <div class="toolbar-group desktop-only toolbar-group-utility" role="group" aria-label="Utilities">
                        <button class="toolbar-btn wp-icon-button" id="htmlModeBtn" title="Edit HTML" aria-label="Edit HTML">HTML</button>
                        <button class="toolbar-btn wp-icon-button" id="formatHtmlBtn" title="Format HTML" aria-label="Format HTML" hidden>Format</button>
                    </div>
                </div>
                <div class="editor-body">
                    <div class="editor-main">
                        <div class="editor-content" id="noteContent" contenteditable="true" placeholder="Start writing your note..."></div>
                        <textarea class="editor-content-html" id="noteContentHtml" hidden spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="Edit raw HTML..."></textarea>
                        <div class="editor-footer">
                            <span id="noteMeta"></span>
                            <span id="lastSaved" class="last-saved"></span>

                            <div class="editor-actions desktop-only">
                                <button class="btn-secondary wp-button wp-button--secondary" id="pinNoteBtn" type="button" title="Pin or unpin this note" aria-label="Pin or unpin this note">Pin</button>
                                <button class="btn-secondary wp-button wp-button--secondary" id="shareLinkBtn" type="button" title="Copy public link" aria-label="Copy public link">Share</button>
                                <button class="btn-secondary wp-button wp-button--secondary" id="editLinkBtn" type="button" title="Copy editable link" aria-label="Copy editable link">Edit link</button>
                                <button class="btn-secondary wp-button wp-button--secondary" id="exportPdfBtn" type="button" title="Export to PDF" aria-label="Export to PDF">PDF</button>
                                <button class="btn-danger wp-button wp-button--danger-subtle deleteBtn" type="button" title="Delete this note" aria-label="Delete this note">Delete</button>
                            </div>

                            <details class="overflow-menu mobile-only">
                                <summary class="overflow-menu-btn wp-icon-button" aria-label="More actions" title="More actions">⋯</summary>
                                <div class="overflow-menu-panel wp-menu">
                                    <button class="overflow-menu-item wp-menu__item" id="pinNoteBtnMobile" type="button">Pin</button>
                                    <button class="overflow-menu-item wp-menu__item" id="shareLinkBtnMobile" type="button">Share (copy link)</button>
                                    <button class="overflow-menu-item wp-menu__item" id="editLinkBtnMobile" type="button">Edit link</button>
                                    <hr class="overflow-menu-sep wp-menu__separator">
                                    <button class="overflow-menu-item wp-menu__item wp-menu__item--danger danger deleteBtn" type="button">Delete</button>
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
                                <div class="inspector-section-heading">Status</div>
                                <div class="inspector-status-card">
                                    <div class="inspector-status-top">
                                        <span class="inspector-note-state" id="inspectorNoteState">Saved</span>
                                        <span class="inspector-pin-badge" id="inspectorPinBadge" hidden>Pinned</span>
                                    </div>
                                </div>
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
                                <div class="inspector-section-heading">Outline</div>
                                <div class="inspector-outline" id="noteInspectorOutline"></div>
                            </section>

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Actions</div>
                                <div class="inspector-actions">
                                    <button class="btn-secondary wp-button wp-button--secondary inspector-action-btn" id="pinNoteBtnInspector" type="button" aria-pressed="false">
                                        <svg class="inspector-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                            <path d="M12 17v5"></path>
                                            <path d="M5 3h14"></path>
                                            <path d="m6 3 1 8-3 3h16l-3-3 1-8"></path>
                                        </svg>
                                        <span class="inspector-action-label">Pin</span>
                                    </button>
                                    <button class="btn-secondary wp-button wp-button--secondary inspector-action-btn" id="shareLinkBtnInspector" type="button">
                                        <svg class="inspector-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                            <circle cx="18" cy="5" r="3"></circle>
                                            <circle cx="6" cy="12" r="3"></circle>
                                            <circle cx="18" cy="19" r="3"></circle>
                                            <path d="m8.6 10.5 6.8-4"></path>
                                            <path d="m8.6 13.5 6.8 4"></path>
                                        </svg>
                                        <span class="inspector-action-label">Share</span>
                                    </button>
                                    <button class="btn-secondary wp-button wp-button--secondary inspector-action-btn" id="editLinkBtnInspector" type="button">
                                        <svg class="inspector-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                            <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path>
                                            <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path>
                                        </svg>
                                        <span class="inspector-action-label">Edit link</span>
                                    </button>
                                    <button class="btn-secondary wp-button wp-button--secondary inspector-action-btn" id="exportPdfBtnInspector" type="button">
                                        <svg class="inspector-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>
                                            <path d="M14 2v6h6"></path>
                                            <path d="M8 15h8"></path>
                                            <path d="M8 18h5"></path>
                                        </svg>
                                        <span class="inspector-action-label">PDF</span>
                                    </button>
                                    <button class="btn-danger wp-button wp-button--danger-subtle inspector-action-btn inspector-action-danger deleteBtn" type="button">
                                        <svg class="inspector-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                            <path d="M3 6h18"></path>
                                            <path d="M8 6V4h8v2"></path>
                                            <path d="M19 6 18 21H6L5 6"></path>
                                            <path d="M10 11v6"></path>
                                            <path d="M14 11v6"></path>
                                        </svg>
                                        <span class="inspector-action-label">Delete</span>
                                    </button>
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

                            <section class="inspector-section">
                                <div class="inspector-section-heading">Note info</div>
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
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    </div>

    <div id="modalOverlay" class="modal-overlay wp-dialog-backdrop" aria-hidden="true">
        <div class="modal-dialog wp-dialog wp-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
            <div class="modal-header wp-dialog__header">
                <h2 class="modal-title" id="modalTitle">Title</h2>
                <button class="modal-close wp-icon-button wp-dialog__close" type="button" data-dialog-close aria-label="Close dialog">&times;</button>
            </div>
            <div class="modal-body wp-dialog__body">
                <p id="modalMessage">Message</p>
            </div>
            <div class="modal-footer wp-dialog__actions">
                <button class="btn-secondary wp-button wp-button--secondary" id="modalCancelBtn">Cancel</button>
                <button class="btn-primary wp-button wp-button--primary" id="modalConfirmBtn">Confirm</button>
            </div>
        </div>
    </div>

    <div id="linkModalOverlay" class="modal-overlay wp-dialog-backdrop" aria-hidden="true">
        <div class="modal-dialog wp-dialog wp-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="linkModalTitle" tabindex="-1">
            <div class="modal-header wp-dialog__header">
                <h2 class="modal-title" id="linkModalTitle">Insert Link</h2>
                <button class="modal-close wp-icon-button wp-dialog__close" type="button" data-dialog-close aria-label="Close dialog">&times;</button>
            </div>
            <div class="modal-body wp-dialog__body">
                <div class="link-dialog-form">
                    <div class="link-dialog-field wp-field">
                        <label for="linkModalTitleInput">Title</label>
                        <input class="wp-input" type="text" id="linkModalTitleInput" placeholder="Link text" autocomplete="off">
                    </div>
                    <div class="link-dialog-field wp-field">
                        <label for="linkModalUrlInput">URL</label>
                        <input class="wp-input" type="url" id="linkModalUrlInput" placeholder="https://example.com" autocomplete="off" required>
                    </div>
                </div>
            </div>
            <div class="modal-footer wp-dialog__actions">
                <button class="btn-secondary wp-button wp-button--secondary" id="linkModalCancelBtn">Cancel</button>
                <button class="btn-primary wp-button wp-button--primary" id="linkModalInsertBtn">Insert</button>
            </div>
        </div>
    </div>

    <script src="vendor/beautify-html.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script type="module" src="app.js"></script>

</body>
</html>
