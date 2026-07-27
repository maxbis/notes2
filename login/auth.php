<?php
/**
 * Shared validation-key auth helpers.
 *
 * Cookie name: validation
 * Cookie value: SHA-256 hex of the plaintext key
 * Allowlist: login/validkeys.txt (one hash per line)
 */

// When set to true, the login validator will expose detailed
// reasons for access being denied. Leave this false in production.
if (!defined('LOGIN_VALIDATION_DEBUG')) {
    define('LOGIN_VALIDATION_DEBUG', true);
}

/**
 * Path to the allowlisted validation hashes file.
 */
function notes_validation_keys_file(): string
{
    return __DIR__ . '/validkeys.txt';
}

/**
 * Validates the validation cookie against validkeys.txt.
 *
 * @return bool True if validation cookie exists and matches a key in validkeys.txt
 */
function validateUser(): bool
{
    $GLOBALS['validationDebugReason'] = null;

    if (!isset($_COOKIE['validation'])) {
        if (LOGIN_VALIDATION_DEBUG) {
            $GLOBALS['validationDebugReason'] = 'Validation cookie is not set.';
        }
        return false;
    }

    $cookieValue = trim((string) $_COOKIE['validation']);

    if ($cookieValue === '') {
        if (LOGIN_VALIDATION_DEBUG) {
            $GLOBALS['validationDebugReason'] = 'Validation cookie is empty.';
        }
        return false;
    }

    $validKeysFile = notes_validation_keys_file();

    if (!file_exists($validKeysFile)) {
        if (LOGIN_VALIDATION_DEBUG) {
            $GLOBALS['validationDebugReason'] = 'The valid keys file (validkeys.txt) was not found.';
        }
        return false;
    }

    $fileContent = file_get_contents($validKeysFile);
    if ($fileContent === false) {
        if (LOGIN_VALIDATION_DEBUG) {
            $GLOBALS['validationDebugReason'] = 'The valid keys file (validkeys.txt) could not be read.';
        }
        return false;
    }

    $lines = explode("\n", $fileContent);

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }

        if ($cookieValue === $line) {
            $GLOBALS['validationDebugReason'] = null;
            return true;
        }
    }

    if (LOGIN_VALIDATION_DEBUG) {
        $GLOBALS['validationDebugReason'] = 'Validation cookie did not match any allowed keys.';
    }
    return false;
}

/**
 * Refresh the validation cookie expiration to ~3 months from now.
 * Same behavior as the original zendure/login gate on successful access.
 */
function refreshValidationCookie(): void
{
    if (!isset($_COOKIE['validation'])) {
        return;
    }

    $cookieValue = (string) $_COOKIE['validation'];
    $expire = time() + (3 * 30 * 24 * 60 * 60); // 3 months
    setcookie('validation', $cookieValue, $expire, '/', '', false, true);
}

/**
 * Set the validation cookie from a plaintext key (SHA-256, 30 days).
 */
function setValidationCookieFromKey(string $plaintextKey): string
{
    $validationHash = hash('sha256', $plaintextKey);
    $expire = time() + (30 * 24 * 60 * 60); // 30 days
    setcookie('validation', $validationHash, $expire, '/', '', false, true);
    return $validationHash;
}

/**
 * Latest validation debug reason when LOGIN_VALIDATION_DEBUG is enabled.
 */
function notes_validation_debug_reason(): ?string
{
    if (!LOGIN_VALIDATION_DEBUG) {
        return null;
    }

    $reason = $GLOBALS['validationDebugReason'] ?? null;
    return is_string($reason) && $reason !== '' ? $reason : null;
}
