<?php
// HTML sanitization for note content

// Placeholder used to preserve newlines inside <pre> and <code> across parse/serialize (PHP parser collapses \n).
const NOTES_PRE_NL_PLACEHOLDER = "\u{E000}";

function sanitize_note_html($html, $allowedTags, $allowedAttrsByTag, $forbiddenTags) {
    if (!is_string($html) || $html === '') return '';

    $placeholder = NOTES_PRE_NL_PLACEHOLDER;

    // Pre-process: replace newlines inside <pre> and <code> with placeholder so the parser does not collapse them.
    // Nested <pre> inside <pre> is not supported; same for <code>. Acceptable for typical note content.
    $html = preg_replace_callback('/(<pre\b[^>]*>)(.*?)(<\/pre>)/s', function ($m) use ($placeholder) {
        return $m[1] . str_replace(["\r\n", "\n", "\r"], $placeholder, $m[2]) . $m[3];
    }, $html);
    $html = preg_replace_callback('/(<code\b[^>]*>)(.*?)(<\/code>)/s', function ($m) use ($placeholder) {
        return $m[1] . str_replace(["\r\n", "\n", "\r"], $placeholder, $m[2]) . $m[3];
    }, $html);

    // DOMDocument is picky; keep errors internal.
    $prev = libxml_use_internal_errors(true);
    libxml_clear_errors();

    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $dom->preserveWhiteSpace = true;

    // Wrap in a root container so we can extract the sanitized innerHTML easily.
    $wrapped = '<div id="__notes_root__">' . $html . '</div>';
    $flags = 0;
    if (defined('LIBXML_HTML_NOIMPLIED')) $flags |= LIBXML_HTML_NOIMPLIED;
    if (defined('LIBXML_HTML_NODEFDTD')) $flags |= LIBXML_HTML_NODEFDTD;

    // Hint encoding to avoid mojibake.
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $wrapped, $flags);

    $root = $dom->getElementById('__notes_root__');
    if (!$root) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        // Fallback: if parsing failed, treat as plain text (restore placeholder so we don't leak it).
        return htmlspecialchars(str_replace($placeholder, "\n", $html), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    $allowedSet = array_fill_keys(array_map('strtolower', $allowedTags), true);
    $forbiddenSet = array_fill_keys(array_map('strtolower', $forbiddenTags), true);

    $sanitizeNode = function ($node) use (&$sanitizeNode, $allowedSet, $allowedAttrsByTag, $forbiddenSet, $dom, $placeholder) {
        if (!$node) return;

        // Remove comments
        if ($node->nodeType === XML_COMMENT_NODE) {
            if ($node->parentNode) $node->parentNode->removeChild($node);
            return;
        }

        if ($node->nodeType !== XML_ELEMENT_NODE) {
            // Text nodes etc are kept as-is.
            return;
        }

        $tag = strtolower($node->nodeName);

        // <br> inside <pre> or <code>: replace with newline placeholder so it survives and is restored as \n later.
        if ($tag === 'br') {
            $p = $node->parentNode;
            while ($p && $p->nodeType === XML_ELEMENT_NODE) {
                $parentTag = strtolower($p->nodeName);
                if ($parentTag === 'pre' || $parentTag === 'code') {
                    $textNode = $dom->createTextNode($placeholder);
                    $node->parentNode->replaceChild($textNode, $node);
                    return;
                }
                $p = $p->parentNode;
            }
        }

        // Remove dangerous tags entirely (including their children).
        if (isset($forbiddenSet[$tag])) {
            if ($node->parentNode) $node->parentNode->removeChild($node);
            return;
        }

        // If tag not allowed: unwrap (keep children/text).
        if (!isset($allowedSet[$tag])) {
            $parent = $node->parentNode;
            if ($parent) {
                while ($node->firstChild) {
                    $parent->insertBefore($node->firstChild, $node);
                }
                $parent->removeChild($node);
            }
            return;
        }

        // Allowed tag: strip attributes unless allowlisted.
        $allowedAttrs = [];
        if (isset($allowedAttrsByTag[$tag]) && is_array($allowedAttrsByTag[$tag])) {
            foreach ($allowedAttrsByTag[$tag] as $a) {
                $allowedAttrs[strtolower($a)] = true;
            }
        }

        if ($node->hasAttributes()) {
            // Snapshot attributes first (live list).
            $toRemove = [];
            foreach ($node->attributes as $attr) {
                $name = strtolower($attr->nodeName);

                // Never allow event handlers or inline styles.
                if (strncmp($name, 'on', 2) === 0 || $name === 'style') {
                    $toRemove[] = $attr->nodeName;
                    continue;
                }

                if (!isset($allowedAttrs[$name])) {
                    $toRemove[] = $attr->nodeName;
                    continue;
                }

                // Normalize numeric attributes
                if ($name === 'colspan' || $name === 'rowspan') {
                    $val = preg_replace('/[^0-9]/', '', (string)$attr->nodeValue);
                    if ($val === '') {
                        $toRemove[] = $attr->nodeName;
                    } else {
                        $node->setAttribute($attr->nodeName, $val);
                    }
                }
            }
            foreach ($toRemove as $attrName) {
                $node->removeAttribute($attrName);
            }
        }

        // Recurse into children (snapshot first, because we may modify DOM).
        $children = [];
        foreach ($node->childNodes as $child) $children[] = $child;
        foreach ($children as $child) $sanitizeNode($child);
    };

    // Sanitize children of root wrapper.
    $rootChildren = [];
    foreach ($root->childNodes as $child) $rootChildren[] = $child;
    foreach ($rootChildren as $child) $sanitizeNode($child);

    // Extract sanitized inner HTML of root.
    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $dom->saveHTML($child);
    }

    // Restore newlines inside <pre> and <code> (and br→placeholder we inserted).
    $out = str_replace($placeholder, "\n", $out);

    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $out;
}
