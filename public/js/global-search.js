import { API_ENDPOINT } from './state.js';
import { readJsonResponse } from './api.js';
import { applySearchHighlights } from './search-highlights.js';

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 20;

function getSearchIntent(value) {
    const query = String(value || '').trim().replace(/\s+/g, ' ');
    const todoCommand = query.match(/^todo(?:\s+(.*))?$/iu);
    return todoCommand
        ? { mode: 'todos', query, term: (todoCommand[1] || '').trim() }
        : { mode: 'notes', query, term: query };
}

function appendHighlightedText(element, text, query) {
    const value = String(text || '');
    const normalizedValue = value.toLocaleLowerCase();
    const normalizedQuery = String(query || '').toLocaleLowerCase();
    let cursor = 0;
    let matchIndex = normalizedQuery ? normalizedValue.indexOf(normalizedQuery) : -1;

    while (matchIndex !== -1) {
        element.append(document.createTextNode(value.slice(cursor, matchIndex)));
        const mark = document.createElement('mark');
        mark.textContent = value.slice(matchIndex, matchIndex + query.length);
        element.append(mark);
        cursor = matchIndex + query.length;
        matchIndex = normalizedValue.indexOf(normalizedQuery, cursor);
    }
    element.append(document.createTextNode(value.slice(cursor)));
}

function resultRank(note, query) {
    const needle = query.toLocaleLowerCase();
    if (String(note.title || '').toLocaleLowerCase().includes(needle)) return 0;
    if ((note.tags || []).some(tag => String(tag).toLocaleLowerCase().includes(needle))) return 1;
    return 2;
}

export function initGlobalSearch({ onSelect }) {
    const trigger = document.getElementById('globalSearchBtn');
    const dialog = document.getElementById('globalSearchDialog');
    const panel = dialog?.querySelector('.global-search-panel');
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('globalSearchResults');
    const closeButton = document.getElementById('globalSearchCloseBtn');
    if (!trigger || !dialog || !panel || !input || !results || !closeButton) return;

    let timerId = null;
    let requestController = null;
    let renderedNotes = [];
    let activeIndex = -1;
    let renderedIntent = getSearchIntent('');

    const setMessage = (message, className = '') => {
        results.replaceChildren();
        const element = document.createElement('div');
        element.className = `global-search-message ${className}`.trim();
        element.textContent = message;
        results.append(element);
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        renderedNotes = [];
        activeIndex = -1;
    };

    const setActiveResult = (nextIndex) => {
        const options = [...results.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        activeIndex = (nextIndex + options.length) % options.length;
        options.forEach((option, index) => {
            const active = index === activeIndex;
            option.classList.toggle('active', active);
            option.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const activeOption = options[activeIndex];
        input.setAttribute('aria-activedescendant', activeOption.id);
        activeOption.scrollIntoView({ block: 'nearest' });
    };

    const chooseResult = async (index) => {
        const note = renderedNotes[index];
        if (!note) return;
        const intent = renderedIntent;
        closeSearch();
        await onSelect(note.hash_id, intent.term);
        applySearchHighlights(intent.term, { scrollToFirst: true });

        if (note.is_todo) {
            const todoItems = [...document.querySelectorAll('#noteContent li.todo-item')];
            const target = todoItems.find(item => note.todo_id && item.dataset.todoId === note.todo_id)
                || todoItems[note.todo_index];
            if (target) {
                target.scrollIntoView({ block: 'center', inline: 'nearest' });
                target.animate(
                    [
                        { backgroundColor: 'var(--wp-accent-soft)' },
                        { backgroundColor: 'transparent' }
                    ],
                    { duration: 1600, easing: 'ease-out' }
                );
            }
        }
    };

    const createResultOption = (note, index, intent, { includeTitle = true, includeTags = true } = {}) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = `global-search-result${note.is_todo ? ' global-search-result--todo' : ''}`;
        option.id = `globalSearchResult-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');

        if (includeTitle) {
            const title = document.createElement('span');
            title.className = 'global-search-result-title';
            appendHighlightedText(title, note.title || 'Untitled', intent.term);
            option.append(title);
        }

        const excerpt = document.createElement('span');
        excerpt.className = 'global-search-result-excerpt';
        appendHighlightedText(excerpt, note.preview || 'Match found in this note.', intent.term);
        option.append(excerpt);

        if (includeTags && Array.isArray(note.tags) && note.tags.length) {
            const tags = document.createElement('span');
            tags.className = 'global-search-result-tags';
            tags.textContent = note.tags.slice(0, 4).map(tag => `#${tag}`).join('  ');
            option.append(tags);
        }

        option.addEventListener('mouseenter', () => setActiveResult(index));
        option.addEventListener('click', () => chooseResult(index));
        return option;
    };

    const renderTodoGroups = (intent) => {
        const groups = new Map();
        renderedNotes.forEach((note, index) => {
            const key = note.hash_id || `todo-group-${index}`;
            const group = groups.get(key) || { note, items: [] };
            group.items.push({ note, index });
            groups.set(key, group);
        });

        groups.forEach(({ note, items }, groupIndex) => {
            const group = document.createElement('section');
            group.className = 'global-search-todo-group';
            group.setAttribute('role', 'group');

            const header = document.createElement('div');
            header.className = 'global-search-todo-group-header';
            const headingId = `globalSearchTodoGroup-${groupIndex}`;
            const heading = document.createElement('span');
            heading.className = 'global-search-todo-group-title';
            heading.id = headingId;
            appendHighlightedText(heading, note.title || 'Untitled', intent.term);
            header.append(heading);
            group.setAttribute('aria-labelledby', headingId);

            const openCount = Number(note.note_open_todo_count) || items.length;
            const count = document.createElement('span');
            count.className = 'global-search-todo-group-count';
            if (intent.term && items.length < openCount) {
                count.textContent = `${items.length} ${items.length === 1 ? 'match' : 'matches'} · ${openCount} open`;
            } else {
                count.textContent = `${openCount} open`;
            }
            header.append(count);
            group.append(header);

            if (Array.isArray(note.tags) && note.tags.length) {
                const tags = document.createElement('div');
                tags.className = 'global-search-todo-group-tags';
                tags.textContent = note.tags.slice(0, 4).map(tag => `#${tag}`).join('  ');
                group.append(tags);
            }

            const itemList = document.createElement('div');
            itemList.className = 'global-search-todo-group-items';
            items.forEach(({ note: todo, index }) => {
                itemList.append(createResultOption(todo, index, intent, {
                    includeTitle: false,
                    includeTags: false
                }));
            });
            group.append(itemList);
            results.append(group);
        });
    };

    const renderResults = (notes, intent, hasMore) => {
        renderedIntent = intent;
        renderedNotes = intent.mode === 'todos'
            ? [...notes]
            : [...notes].sort((left, right) => resultRank(left, intent.term) - resultRank(right, intent.term));
        activeIndex = -1;
        results.replaceChildren();

        if (!renderedNotes.length) {
            const message = intent.mode === 'todos'
                ? (intent.term ? `No open todos found for “${intent.term}”.` : 'No open todos found.')
                : `No notes found for “${intent.query}”.`;
            setMessage(message);
            return;
        }

        if (intent.mode === 'todos') {
            renderTodoGroups(intent);
        } else {
            renderedNotes.forEach((note, index) => {
                results.append(createResultOption(note, index, intent));
            });
        }

        if (hasMore) {
            const more = document.createElement('div');
            more.className = 'global-search-more';
            more.textContent = `Showing the first ${RESULT_LIMIT} matches. Refine your search to narrow the results.`;
            results.append(more);
        }
        input.setAttribute('aria-expanded', 'true');
    };

    const runSearch = async () => {
        const intent = getSearchIntent(input.value);
        if (intent.query.length < MIN_QUERY_LENGTH) {
            setMessage('Type at least 2 characters to search, or enter todo for open todos.');
            return;
        }

        if (requestController) requestController.abort();
        requestController = new AbortController();
        setMessage('Searching…', 'global-search-message--loading');
        try {
            const params = new URLSearchParams({
                view: intent.mode === 'todos' ? 'todos' : 'list',
                limit: String(RESULT_LIMIT),
                q: intent.term
            });
            if (intent.mode === 'notes') params.set('snippets', 'match');
            const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
                signal: requestController.signal
            });
            const data = await readJsonResponse(response, 'globalSearch');
            if (!response.ok || data?.error) throw new Error(data?.error || `HTTP ${response.status}`);
            if (intent.query !== getSearchIntent(input.value).query) return;
            renderResults(Array.isArray(data?.notes) ? data.notes : [], intent, data?.has_more === true);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error('Global search failed:', error);
            setMessage('Search is unavailable. Please try again.');
        }
    };

    const openSearch = () => {
        dialog.hidden = false;
        document.body.classList.add('global-search-open');
        requestAnimationFrame(() => input.focus());
    };

    function closeSearch() {
        clearTimeout(timerId);
        if (requestController) requestController.abort();
        requestController = null;
        dialog.hidden = true;
        document.body.classList.remove('global-search-open');
        input.setAttribute('aria-expanded', 'false');
        trigger.focus();
    }

    trigger.addEventListener('click', openSearch);
    closeButton.addEventListener('click', closeSearch);
    dialog.addEventListener('pointerdown', event => {
        if (event.target === dialog) closeSearch();
    });
    input.addEventListener('input', () => {
        clearTimeout(timerId);
        if (requestController) requestController.abort();
        const query = input.value.trim();
        if (query.length < MIN_QUERY_LENGTH) {
            setMessage('Type at least 2 characters to search, or enter todo for open todos.');
            return;
        }
        setMessage('Searching…', 'global-search-message--loading');
        timerId = setTimeout(runSearch, SEARCH_DELAY_MS);
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveResult(activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveResult(activeIndex - 1);
        } else if (event.key === 'Enter' && renderedNotes.length) {
            event.preventDefault();
            chooseResult(activeIndex >= 0 ? activeIndex : 0);
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !dialog.hidden) closeSearch();
    });
}
