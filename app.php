<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notes - Simple Note Taking</title>
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
                    <input type="text" id="noteTitle" placeholder="Title...">
                    <div class="editor-actions">
                        <button class="btn-secondary" id="saveBtn">Save</button>
                        <button class="btn-danger" id="deleteBtn">Delete</button>
                    </div>
                </div>
                <textarea id="noteContent" placeholder="Start writing your note..."></textarea>
                <div class="editor-footer">
                    <span id="noteMeta"></span>
                </div>
            </main>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
