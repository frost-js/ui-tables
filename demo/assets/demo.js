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
        length: 5,
        lengths: [5, 10, 25],
        ...options,
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

    const detailRows = rows.map(([name, team, score], index) => [
        name, team, score, `member${index + 1}@example.com`, 'Available for project reviews',
    ]);
    const renderDetails = (row, { columns }) => {
        const items = columns.map(({ title, html }) => {
            const label = $.getHtml($.create('span', { text: title }));

            return `<li><strong>${label}:</strong> ${html}</li>`;
        });

        return `<ul class="mb-0">${items.join('')}</ul>`;
    };

    let dataTable;
    const filterScores = () => {
        const filters = [];
        const team = $.getValue(node('data-team'));
        const score = $.getValue(node('data-score'));

        if (team) {
            filters.push({ column: 1, operator: 'equals', value: team });
        }

        if (score) {
            filters.push({ column: 2, operator: 'gte', value: Number(score) });
        }

        dataTable.setFilters(filters);
    };

    const initializeData = () => {
        dataTable?.dispose();

        const objects = $.getValue(node('data-source')) === 'objects';
        const keys = objects ? ['person.name', 'person.team', 'score', 'person.email', 'notes'] : [0, 1, 2, 3, 4];
        const options = {
            data: objects ? detailRows.map(([name, team, score, email, notes]) => ({
                person: { name, team, email },
                score,
                notes,
            })) : detailRows,
            rowId: keys[0],
            responsive: true,
            renderDetails: $.getProperty(node('data-details'), 'checked') ? renderDetails : null,
            columns: [
                { data: keys[0], responsivePriority: null },
                { data: keys[1], responsivePriority: 2 },
                {
                    data: keys[2],
                    class: 'text-end',
                    type: 'number',
                    responsivePriority: 1,
                    render: (value, { purpose }) => purpose === 'display' ? `<strong>${Number(value)}</strong>` : value,
                    createdCell(cell, value) {
                        if (value >= 90) {
                            $.addClass(cell, 'text-success', 'fw-bold');
                        }
                    },
                },
                { data: keys[3], responsivePriority: 3 },
                { data: keys[4], responsivePriority: 4 },
            ],
            buttons: [
                { type: 'columns' },
                { type: 'csv', scope: 'filtered', title: 'Matching team scores' },
                { type: 'excel', scope: 'all', title: 'All team scores' },
                { type: 'print', scope: 'page', title: 'Team scores' },
            ],
            order: [[1, 'asc'], [2, 'desc']],
            rowCallback(row, data) {
                const score = objects ? data.score : data[2];

                $[score >= 90 ? 'addClass' : 'removeClass'](row, 'table-active');
            },
            footerCallback(footer) {
                const total = this.getColumn(keys[2]).reduce((sum, value) => sum + Number(value), 0);

                $.setText($.findOne('[data-demo-total]', footer), total);
            },
        };

        dataTable = init('data-table', options);
        filterScores();

        $.setText(node('data-config'), JSON.stringify({
            data: options.data.slice(0, 1),
            rowId: options.rowId,
            columns: options.columns.map(({ data, type }) => ({ data, type })),
        }, null, 4));
    };

    $.addEvent(node('data-source'), 'change', initializeData);
    $.addEvent(node('data-details'), 'change', initializeData);
    $.addEvent(node('data-team'), 'change', filterScores);
    $.addEvent(node('data-score'), 'change', filterScores);
    $.addEvent(node('data-width'), 'change', () => {
        $.setStyle(node('data-preview'), {
            'max-width': $.getValue(node('data-width')) === 'narrow' ? '20rem' : 'none',
        });
    });

    initializeData();

    let requestId = 0;
    let failNext = false;
    const remoteRows = Array.from({ length: 35 }, (_, index) => [
        `${names[index % names.length]} ${index + 1}`, teams[index % teams.length], 65 + index,
    ]);
    const logRequest = (message) => {
        const item = $.create('li');

        $.setText(item, message);
        $.prepend(node('request-log'), item);

        if ($.children(node('request-log')).length > 30) {
            $.remove($.children(node('request-log')).at(-1));
        }
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

                        if (diff) {
                            return dir === 'desc' ? -diff : diff;
                        }
                    }

                    return 0;
                });

                logRequest(`#${id}: completed, ${results.length} matches`);
                resolve({
                    results: results.slice(request.offset || 0, (request.offset || 0) + (request.limit || results.length)),
                    total: remoteRows.length,
                    filtered: results.length,
                });
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
        failNext = true;
        remote.reload();
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
        getRowById: ['Alice'],
        getSelectedIds: [],
        getState: [],
        info: [],
        selectRows: [{ scope: 'filtered' }],
        setData: [rows],
        setRowById: ['Alice', ['Alice', 'Design', 99]],
        setValue: [0, 2, 99],
    };
    const eventNames = [
        'init', 'length', 'order', 'page', 'search', 'filter', 'selectionchange', 'statechange',
        'processing', 'processed', 'preDraw', 'draw', 'error',
    ];

    $.addEvent('#method-table', eventNames.map((name) => `${name}.ui.table`).join(' '), (event) => {
        logEvent(`${event.type}.ui.table`);
    });

    let savedState = null;
    const initMethods = () => init('method-table', {
        data: rows.slice(0, 6),
        rowId: 0,
        selection: 'multiple',
        layout: { top: 'selection,search|length', bottom: 'info,pagination' },
    });
    let methodTable = initMethods();

    $('[data-demo-method]').addEvent('click', (event) => {
        try {
            const method = $.getAttribute(event.currentTarget, 'data-demo-method');

            if (method === 'init') {
                methodTable = initMethods();
                $.setText(node('method-output'), 'Initialized.');

                return;
            }

            if (!methodTable.node) {
                throw new Error('Choose Init to initialize the table again.');
            }

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
