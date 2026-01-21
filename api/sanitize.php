<?php
// HTML sanitization for note content

function sanitize_note_html($html, $allowedTags, $allowedAttrsByTag, $forbiddenTags) {
    if (!is_string($html) || $html === '') return '';

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
        // Fallback: if parsing failed, treat as plain text.
        return htmlspecialchars($html, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    $allowedSet = array_fill_keys(array_map('strtolower', $allowedTags), true);
    $forbiddenSet = array_fill_keys(array_map('strtolower', $forbiddenTags), true);

    $sanitizeNode = function ($node) use (&$sanitizeNode, $allowedSet, $allowedAttrsByTag, $forbiddenSet) {
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

    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $out;
}
