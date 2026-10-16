import state from './state.js';
import { escapeHtml } from './utils.js';

const MAX_TAG_LENGTH = 64;
const DEFAULT_VISIBLE_SIDEBAR_TAGS = 3;
let tagChangeHandler = null;

function normalizeSingleTag(tag) {
    const normalized = String(tag ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, MAX_TAG_LENGTH)
        .trim();
    return normalized;
}

export function normalizeTagList(tags) {
    const unique = new Set();
    for (const tag of Array.isArray(tags) ? tags : []) {
        const normalized = normalizeSingleTag(tag);
        if (normalized) unique.add(normalized);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function tagsEqual(a, b) {
    const left = normalizeTagList(a);
    const right = normalizeTagList(b);
    if (left.length !== right.length) return false;
    return left.every((tag, index) => tag === right[index]);
}

export function getCurrentTags() {
    return normalizeTagList(state.currentTags);
}

export function setCurrentTags(tags) {
    state.currentTags = normalizeTagList(tags);
    renderTagEditor();
}

export function setSavedTags(tags) {
    state.savedTags = normalizeTagList(tags);
}

export function addTag(tag) {
    const normalized = normalizeSingleTag(tag);
    if (!normalized) return false;
    const next = normalizeTagList([...state.currentTags, normalized]);
    if (tagsEqual(next, state.currentTags)) return false;
    state.currentTags = next;
    renderTagEditor();
    return true;
}

export function removeTag(tag) {
    const normalized = normalizeSingleTag(tag);
    const next = normalizeTagList(state.currentTags.filter(value => value !== normalized));
    if (tagsEqual(next, state.currentTags)) return false;
    state.currentTags = next;
    renderTagEditor();
    return true;
}

export function clearActiveTagFilters() {
    state.activeTagFilters = [];
    renderSidebarTagFilters();
}

export function toggleActiveTagFilter(tag) {
    const normalized = normalizeSingleTag(tag);
    if (!normalized) return false;
    const exists = state.activeTagFilters.includes(normalized);
    state.activeTagFilters = exists
        ? state.activeTagFilters.filter(value => value !== normalized)
        : normalizeTagList([...state.activeTagFilters, normalized]);
    renderSidebarTagFilters();
    return true;
}

export function getActiveTagFilters() {
    return normalizeTagList(state.activeTagFilters);
}

export function noteMatchesActiveTags(note) {
    const filters = getActiveTagFilters();
    if (!filters.length) return true;
    const tags = normalizeTagList(note?.tags || []);
    return filters.every(tag => tags.includes(tag));
}

export function getAllAvailableTags(notes = state.notes) {
    const metadata = new Map();
    for (const note of Array.isArray(notes) ? notes : []) {
        const updatedAt = note?.updated_at ? new Date(note.updated_at).getTime() : 0;
        for (const tag of normalizeTagList(note?.tags || [])) {
            const current = metadata.get(tag) || { count: 0, lastUsedAt: 0 };
            current.count += 1;
            current.lastUsedAt = Math.max(current.lastUsedAt, Number.isFinite(updatedAt) ? updatedAt : 0);
            metadata.set(tag, current);
        }
    }
    return Array.from(metadata.entries())
        .map(([tag, value]) => ({ tag, count: value.count, lastUsedAt: value.lastUsedAt }));
}

function rankSidebarTags(tags, active) {
    return [...tags].sort((left, right) => {
        const leftActive = active.includes(left.tag);
        const rightActive = active.includes(right.tag);
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        if (right.lastUsedAt !== left.lastUsedAt) return right.lastUsedAt - left.lastUsedAt;
        if (right.count !== left.count) return right.count - left.count;
        return left.tag.localeCompare(right.tag);
    });
}

export function renderTagEditor() {
    const editors = [
        { chipsEl: document.getElementById('tagChips'), inputEl: document.getElementById('tagInput') },
        { chipsEl: document.getElementById('tagChipsInspector'), inputEl: document.getElementById('tagInputInspector') }
    ].filter(({ chipsEl, inputEl }) => chipsEl && inputEl);
    if (!editors.length) return;

    const markup = state.currentTags.map(tag => `
        <button type="button" class="tag-chip removable" data-tag="${escapeHtml(tag)}" aria-label="Remove tag ${escapeHtml(tag)}">
            <span class="tag-chip-label">${escapeHtml(tag)}</span>
            <span class="tag-chip-remove" aria-hidden="true">×</span>
        </button>
    `).join('');

    editors.forEach(({ chipsEl, inputEl }) => {
        chipsEl.innerHTML = markup;
        chipsEl.querySelectorAll('.tag-chip.removable').forEach(button => {
            button.addEventListener('click', () => {
                if (removeTag(button.dataset.tag || '')) {
                    if (typeof tagChangeHandler === 'function') tagChangeHandler();
                    inputEl.focus();
                }
            });
        });
    });
}

export function renderSidebarTagFilters() {
    const container = document.getElementById('tagFilters');
    if (!container) return;

    const active = getActiveTagFilters();
    const allTags = rankSidebarTags(getAllAvailableTags(), active);

    if (!allTags.length) {
        state.activeTagFilters = [];
        state.showAllSidebarTags = false;
        container.innerHTML = '';
        container.hidden = true;
        return;
    }

    const primaryTags = [];
    const overflowTags = [];
    for (const tagMeta of allTags) {
        const isActive = active.includes(tagMeta.tag);
        if (isActive || primaryTags.length < DEFAULT_VISIBLE_SIDEBAR_TAGS) {
            primaryTags.push(tagMeta);
        } else {
            overflowTags.push(tagMeta);
        }
    }

    const visibleTags = state.showAllSidebarTags
        ? [...primaryTags, ...overflowTags]
        : primaryTags;
    const hiddenCount = overflowTags.length;

    container.hidden = false;
    const clearButton = active.length
        ? `<button type="button" class="tag-filter-clear" id="clearTagFiltersBtn">Clear</button>`
        : '';
    const moreButton = hiddenCount > 0
        ? `<button type="button" class="tag-filter-more" id="toggleTagFiltersBtn">${state.showAllSidebarTags ? 'Show less' : `Show ${hiddenCount} more`}</button>`
        : '';

    container.innerHTML = `
        <div class="tag-filter-header">
            <span class="tag-filter-title">Tags</span>
            <div class="tag-filter-actions">
                ${moreButton}
                ${clearButton}
            </div>
        </div>
        <div class="tag-filter-chips compact">
            ${visibleTags.map(({ tag, count }) => `
                <button type="button" class="tag-chip sidebar ${active.includes(tag) ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
                    <span class="tag-chip-label">${escapeHtml(tag)}</span>
                    <span class="tag-chip-count">${count}</span>
                </button>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.tag-chip.sidebar').forEach(button => {
        button.addEventListener('click', () => {
            toggleActiveTagFilter(button.dataset.tag || '');
            document.getElementById('searchInput')?.dispatchEvent(new Event('input'));
        });
    });

    const clearBtn = document.getElementById('clearTagFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearActiveTagFilters();
            document.getElementById('searchInput')?.dispatchEvent(new Event('input'));
        });
    }

    const toggleBtn = document.getElementById('toggleTagFiltersBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            state.showAllSidebarTags = !state.showAllSidebarTags;
            renderSidebarTagFilters();
        });
    }
}

export function initTagInput(onChange) {
    tagChangeHandler = onChange;
    const inputs = [document.getElementById('tagInput'), document.getElementById('tagInputInspector')]
        .filter(Boolean);
    if (!inputs.length) return;

    inputs.forEach((inputEl) => {
        const commitPendingValue = () => {
            const value = inputEl.value;
            inputEl.value = '';
            const changed = addTag(value);
            if (changed) onChange();
        };

        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                commitPendingValue();
                return;
            }
            if (event.key === 'Backspace' && inputEl.value === '' && state.currentTags.length > 0) {
                event.preventDefault();
                const lastTag = state.currentTags[state.currentTags.length - 1];
                if (removeTag(lastTag)) onChange();
            }
        });

        inputEl.addEventListener('blur', () => {
            if (inputEl.value.trim() !== '') {
                commitPendingValue();
            }
        });
    });
}
