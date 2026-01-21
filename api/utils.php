<?php
// Utility functions

/**
 * Generate a unique hash ID for notes
 */
function generateHashId() {
    return substr(str_shuffle(str_repeat('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 22)), 0, 22);
}
