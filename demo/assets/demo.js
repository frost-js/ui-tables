const $ = globalThis.fQuery;
const { Table } = globalThis.UI;
const themeKey = 'frostui-tables-demo-theme';

const setTheme = (theme) => {
    if (theme === 'system') {
        $(document.documentElement).removeAttribute('data-ui-theme');
    } else {
        $(document.documentElement).setAttribute('data-ui-theme', theme);
    }

    $('[data-demo-theme]').setValue(theme);
};

const logEvent = (message, className = 'text-body-secondary') => {
    const log = $.findOne('#event-log');
    const entry = $.create('div', {
        class: ['small', 'font-monospace', 'py-2', 'border-bottom', className],
        text: message,
    });

    $.append(log, entry);

    while ($.children(log).length > 50) {
        $.remove($.child(log)[0]);
    }

    $.setScrollY(log, $.height(log, { boxSize: $.SCROLL_BOX }));
};

$.ready(() => {
    let storedTheme;

    try {
        storedTheme = localStorage.getItem(themeKey);
    } catch {
        // The demo remains usable when browser storage is unavailable.
    }

    const requestedTheme = new URLSearchParams(location.search).get('theme');
    const initialTheme = requestedTheme || storedTheme;
    setTheme(['light', 'dark'].includes(initialTheme) ? initialTheme : 'system');

    $('[data-demo-theme]').addEvent('change', (event) => {
        const theme = $.getValue(event.currentTarget);
        setTheme(theme);

        try {
            if (theme === 'system') {
                localStorage.removeItem(themeKey);
            } else {
                localStorage.setItem(themeKey, theme);
            }
        } catch {
            // Theme selection still applies for the current page.
        }
    });

    $('#clear-log').addEvent('click', () => {
        $('#event-log').empty();
    });

    const names = ['Alice', 'Bob', 'Café team', 'Dana', 'Ellis', 'Fran', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Luca'];
    const teams = ['Design', 'Engineering', 'Support'];
    const rows = names.map((name, index) => [name, teams[index % teams.length], 80 + index]);
    const node = (id) => $.findOneById(id);
    const init = (id, options = {}) => Table.init(node(id), {
        length: 5, lengths: [5, 10, 25], ...options,
    });

    Table.layout.demoSummary = function(container) {
        $.addClass(container, 'd-flex', 'align-items-center', 'fw-bold');
        $.setText(container, 'Team leaderboard');
    };

    let controls;
    const initializeControls = () => {
        controls?.dispose();
        const options = {
            length: 5,
            lengths: [5, 10, 25],
            searching: $.getProperty(node('allow-search'), 'checked'),
            ordering: $.getProperty(node('allow-order'), 'checked'),
            paging: $.getProperty(node('allow-page'), 'checked'),
            inputStyle: $.getValue(node('input-style')),
        };
        if ($.getProperty(node('custom-layout'), 'checked')) {
            options.layout = { top: 'demoSummary,search', bottom: 'length,info|pagination' };
        }
        // The plugin and class share instances and public methods.
        controls = $('#basic-table').table(options);
    };
    for (const id of ['allow-search', 'allow-order', 'allow-page', 'input-style', 'custom-layout']) {
        $.addEvent(node(id), 'change', initializeControls);
    }
    initializeControls();
    $.addEvent(node('toggle-direction'), 'click', (event) => {
        const rtl = $.getProperty(node('direction-host'), 'dir') !== 'rtl';
        $.setProperty(node('direction-host'), 'dir', rtl ? 'rtl' : 'ltr');
        $.setAttribute(event.currentTarget, 'aria-pressed', String(rtl));
    });

    let dataTable;
    const initializeData = () => {
        dataTable?.dispose();
        const objects = $.getValue(node('data-source')) === 'objects';
        const options = objects ? {
            data: rows.map(([name, team, score]) => ({ person: { name, team }, score })),
            columns: [{ data: 'person.name' }, { data: 'person.team' }, { data: 'score', class: 'text-end' }],
        } : { data: rows };
        dataTable = init('data-table', { ...options, order: [[1, 'asc'], [2, 'desc']] });
        $.setText(node('data-config'), objects ?
            `Table.init(table, {
    data: [{ person: { name: 'Alice', team: 'Design' }, score: 80 }],
    columns: [
        { data: 'person.name' },
        { data: 'person.team' },
        { data: 'score', class: 'text-end' },
    ],
    order: [[1, 'asc'], [2, 'desc']],
});` :
            `Table.init(table, {
    data: [['Alice', 'Design', 80]],
    order: [[1, 'asc'], [2, 'desc']],
});`);
    };
    $.addEvent(node('data-source'), 'change', initializeData);
    initializeData();

    const callbackTable = init('callback-table', {
        data: rows,
        columns: [{}, {}, {
            class: 'text-end',
            type: 'number',
            render: (value, { purpose }) => purpose === 'display' ? `<strong>${Number(value)}</strong>` : value,
            createdCell(cell, value) {
                if (value >= 90) $.addClass(cell, 'text-success', 'fw-bold');
            },
        }],
        rowCallback(row, data) {
            $[data[2] >= 90 ? 'addClass' : 'removeClass'](row, 'table-active');
        },
        footerCallback(footer) {
            $.setText($.findOne('td:last-child', footer), this.getColumn(2).reduce((sum, value) => sum + Number(value), 0));
        },
        drawCallback() {
            $.setText(node('callback-summary'), `${this.info().filtered} matching rows. Scores of 90 or more are highlighted.`);
        },
    });

    const filterScores = () => {
        const filters = [];
        const team = $.getValue(node('callback-team'));
        const score = $.getValue(node('callback-score'));

        if (team) {
            filters.push({ column: 1, operator: 'equals', value: team });
        }

        if (score) {
            filters.push({ column: 2, operator: 'gte', value: Number(score) });
        }

        callbackTable.setFilters(filters);
    };
    $.addEvent(node('callback-team'), 'change', filterScores);
    $.addEvent(node('callback-score'), 'change', filterScores);

    const exportsTable = init('export-table', {
        data: rows,
        buttons: [
            { type: 'csv', scope: 'filtered', text: 'CSV matches', title: 'Matching team scores' },
            { type: 'excel', scope: 'all', text: 'Excel all rows', title: 'All team scores' },
            { type: 'print', scope: 'page', text: 'Print page', title: 'Team scores' },
        ],
    });
    $.addEvent(node('toggle-team'), 'click', (event) => {
        const hidden = $.getAttribute(event.currentTarget, 'aria-pressed') !== 'true';
        exportsTable[hidden ? 'hideColumn' : 'showColumn'](1);
        $.setAttribute(event.currentTarget, 'aria-pressed', String(hidden));
        $.setText(event.currentTarget, hidden ? 'Show Team column' : 'Hide Team column');
    });

    let requestId = 0;
    let failNext = false;
    const remoteRows = Array.from({ length: 35 }, (_, index) => [
        `${names[index % names.length]} ${index + 1}`, teams[index % teams.length], 65 + index,
    ]);
    const logRequest = (message) => {
        const item = $.create('li');
        $.setText(item, message);
        $.prepend(node('request-log'), item);
        if ($.children(node('request-log')).length > 30) $.remove($.children(node('request-log')).at(-1));
    };
    /**
     * Simulates a service that filters, sorts and pages a complete dataset.
     * @param {object} request The table request.
     * @returns {Promise<object>} A cancellable delayed response.
     */
    const getResults = (request) => {
        const id = ++requestId;
        const shouldFail = failNext;
        failNext = false;
        logRequest(`#${id}: search "${request.term || ''}", offset ${request.offset || 0}`);
        let timer;
        let rejectPending;
        const pending = new Promise((resolve, reject) => {
            rejectPending = reject;
            timer = setTimeout(() => {
                if (shouldFail || request.term?.toLowerCase() === 'error') {
                    logRequest(`#${id}: failed`);
                    reject(new Error('Simulated request failure. Press Retry to try again.'));
                    return;
                }
                const term = (request.term || '').toLowerCase();
                const results = remoteRows.filter((row) => row.some((value) => String(value).toLowerCase().includes(term)));
                results.sort((a, b) => {
                    for (const { column, dir } of Object.values(request.order || {})) {
                        const diff = column === 2 ? a[column] - b[column] : String(a[column]).localeCompare(String(b[column]));
                        if (diff) return dir === 'desc' ? -diff : diff;
                    }
                    return 0;
                });
                logRequest(`#${id}: completed, ${results.length} matches`);
                resolve({ results: results.slice(request.offset || 0, (request.offset || 0) + (request.limit || results.length)), total: remoteRows.length, filtered: results.length });
            }, 600);
        });
        pending.cancel = () => {
            clearTimeout(timer);
            logRequest(`#${id}: cancelled`);
            rejectPending(new DOMException('Request cancelled', 'AbortError'));
        };
        return pending;
    };
    $.addEvent('#remote-table', 'processing.ui.table', () => {
        $.setText(node('remote-message'), 'Loading results…');
    });
    $.addEvent('#remote-table', 'draw.ui.table', () => {
        $.setText(node('remote-message'), 'Results ready.');
    });
    $.addEvent('#remote-table', 'error.ui.table', (event) => {
        $.setText(node('remote-message'), event.detail.error.message);
    });
    const remote = init('remote-table', { getResults, debounce: 100 });
    $.addEvent(node('fail-request'), 'click', () => {
        failNext = true; remote.reload();
    });
    $.addEvent(node('retry-request'), 'click', () => {
        remote.search('');
    });
    $.addEvent(node('replace-request'), 'click', () => {
        remote.search('Alice');
        setTimeout(() => remote.search('Bob'), 200);
    });

    const methods = {
        addRows: [[['Morgan', 'Support', 97], ['Noor', 'Engineering', 94]]],
        clear: [],
        dispose: [],
        getData: [{ scope: 'filtered' }],
        getState: [],
        info: [],
        setData: [rows],
        setValue: [0, 2, 99],
    };
    const eventNames = ['init', 'length', 'order', 'page', 'search', 'filter', 'statechange', 'processing', 'processed', 'preDraw', 'draw', 'error'];
    $.addEvent('#method-table', eventNames.map((name) => `${name}.ui.table`).join(' '), (event) => {
        logEvent(`${event.type}.ui.table`);
    });
    let savedState = null;
    let methodTable = init('method-table');
    $('[data-demo-method]').addEvent('click', (event) => {
        try {
            const method = $.getAttribute(event.currentTarget, 'data-demo-method');
            if (method === 'init') {
                methodTable = init('method-table');
                $.setText(node('method-output'), 'Initialized.');
                return;
            }
            if (!methodTable.node) throw new Error('Choose Init to initialize the table again.');
            const args = method === 'setState' ? [savedState] : methods[method];
            const result = methodTable[method](...args);

            if (method === 'getState') {
                savedState = result;
                $.setProperty(node('restore-state'), 'disabled', false);
            }

            $.setText(node('method-output'), result === undefined ? `${method}() completed.` : JSON.stringify(result, null, 2));
        } catch (error) {
            $.setText(node('method-output'), error.message);
        }
    });
});
