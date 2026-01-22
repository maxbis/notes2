// Global application state - using a mutable object to allow property assignment
const state = {
    currentNote: null,
    notes: [],
    autoSaveTimer: null,
    hasUnsavedChanges: false,
    savedTitle: '',
    savedContent: '',
    originalVersion: null, // Store original version for conflict detection
    isIndicatorSaveInProgress: false,
    
    // Prevent overlapping saves (auto-save can otherwise self-conflict via optimistic locking)
    saveRunnerPromise: null,
    savePending: false,
    savePendingShowFeedback: false,
    savePendingForceOverwrite: false,
    saveIdleWaiters: [],
    
    // Prevent multiple simultaneous unload saves
    unloadSaveInProgress: false,
    
    // Editor state
    isHtmlMode: false,
    // In HTML mode, we show formatted HTML for readability but keep a canonical raw string
    // for saving/change detection to avoid false "unsaved" states caused by pretty-printing.
    htmlModeRawHtml: '',
    htmlModeDirty: false
};

export default state;

// Also export constants and commonly used properties for convenience
export const API_ENDPOINT = 'api.php';

// Export individual properties for convenience (read-only access)
export const currentNote = () => state.currentNote;
export const notes = () => state.notes;
export const hasUnsavedChanges = () => state.hasUnsavedChanges;
export const isHtmlMode = () => state.isHtmlMode;
