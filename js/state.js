// Auto-save configuration
export const AUTO_SAVE_DELAY_MS = 4000; // Delay in milliseconds before auto-saving after user stops typing

// Global application state - using a mutable object to allow property assignment
const state = {
    currentNote: null,
    notes: [],
    /** hash_id of the note set as "easy access" (public.php with no id redirects here), or null */
    publicDefaultHashId: null,
    hasUnsavedChanges: false,
    savedTitle: '',
    savedContent: '',
    originalVersion: null, // Store original version for conflict detection
    isIndicatorSaveInProgress: false,
    
    // Auto-save timer
    autoSaveTimer: null,
    
    // Save queue state: prevents overlapping saves that could cause self-conflicts via optimistic locking.
    // The queue ensures only one save operation runs at a time, with subsequent saves queued and coalesced.
    saveQueue: {
        runnerPromise: null,            // Promise for the currently running save queue processor
        pending: false,                 // Whether a save is queued
        pendingShowFeedback: false,    // Whether the queued save should show feedback
        pendingForceOverwrite: false,  // Whether the queued save should force overwrite
        idleWaiters: []                // Promises waiting for the queue to become idle
    },
    
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

export const isHtmlMode = () => state.isHtmlMode;
