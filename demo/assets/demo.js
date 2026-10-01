const $ = globalThis.fQuery;
const { Table } = globalThis.UI;

const themeControl = document.querySelector('#demo-theme');
const setTheme = (theme) => {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-ui-theme');
    } else {
        document.documentElement.dataset.uiTheme = theme;
    }
    themeControl.value = theme;
};
try {
    const theme = localStorage.getItem('frostui-tables-demo-theme');
    setTheme(['light', 'dark'].includes(theme) ? theme : 'system');
} catch {
    setTheme('system');
}
themeControl.addEventListener('change', () => {
    setTheme(themeControl.value);
    try {
        localStorage.setItem('frostui-tables-demo-theme', themeControl.value);
    } catch {
        // Theme selection still works when browser storage is unavailable.
    }
});

const names = ['Alice', 'Bob', 'Café team', 'Dana', 'Ellis', 'Fran', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Luca'];
const teams = ['Design', 'Engineering', 'Support'];
const rows = names.map((name, index) => [name, teams[index % teams.length], 80 + index]);
const node = (id) => document.getElementById(id);
const init = (id, options = {}) => Table.init(node(id), {
    length: 5, lengths: [5, 10, 25], ...options,
});

// The plugin and class share instances and public methods.
$('#basic-table').table({ length: 5, lengths: [5, 10, 25] });
init('array-table', { data: rows, order: [[1, 'asc'], [2, 'desc']] });
init('object-table', {
    data: rows.map(([name, team, score]) => ({ person: { name, team }, score })),
    columns: [{ data: 'person.name' }, { data: 'person.team' }, { data: 'score', class: 'text-end' }],
    inputStyle: 'outline',
});
const empty = init('empty-table');
node('add-empty').addEventListener('click', () => empty.addRow(['New teammate', 'Design', 0]));

let controls;
const initializeControls = () => {
    controls?.dispose();
    controls = init('control-table', {
        data: rows,
        searching: node('allow-search').checked,
        ordering: node('allow-order').checked,
        paging: node('allow-page').checked,
        inputStyle: node('input-style').value,
    });
};
for (const id of ['allow-search', 'allow-order', 'allow-page', 'input-style']) {
    node(id).addEventListener('change', initializeControls);
}
initializeControls();

init('callback-table', {
    data: rows,
    columns: [{}, {}, {
        class: 'text-end',
        format: (value) => `<strong>${Number(value)}</strong>`,
        createdCell(cell, value) {
            if (value >= 90) cell.classList.add('text-success', 'fw-bold');
        },
    }],
    rowCallback(row, data) {
        row.classList.toggle('table-active', data[2] >= 90);
    },
    footerCallback(footer) {
        footer.querySelector('td:last-child').textContent = this.getColumn(2).reduce((sum, value) => sum + Number(value), 0);
    },
    drawCallback() {
        node('callback-summary').textContent = `${this.info().filtered} matching rows. Scores of 90 or more are highlighted.`;
    },
});

Table.layout.demoSummary = function(container) {
    container.classList.add('d-flex', 'align-items-center', 'fw-bold');
    container.textContent = 'Team leaderboard';
};
init('layout-table', { data: rows, layout: { top: 'demoSummary,search', bottom: 'length,info|pagination' } });
node('toggle-direction').addEventListener('click', (event) => {
    const rtl = node('direction-host').dir !== 'rtl';
    node('direction-host').dir = rtl ? 'rtl' : 'ltr';
    event.currentTarget.setAttribute('aria-pressed', String(rtl));
});

const exportsTable = init('export-table', {
    data: rows,
    buttons: [
        { type: 'csv', title: 'Team scores' },
        { type: 'excel', title: 'Team scores' },
        { type: 'print', title: 'Team scores' },
        { text: 'Show 25 rows', callback() {
            this.length(25);
        } },
    ],
});
node('toggle-team').addEventListener('click', (event) => {
    const hidden = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    exportsTable[hidden ? 'hideColumn' : 'showColumn'](1);
    event.currentTarget.setAttribute('aria-pressed', String(hidden));
    event.currentTarget.textContent = hidden ? 'Show Team column' : 'Hide Team column';
});

let requestId = 0;
let failNext = false;
const remoteRows = Array.from({ length: 35 }, (_, index) => [
    `${names[index % names.length]} ${index + 1}`, teams[index % teams.length], 65 + index,
]);
const logRequest = (message) => {
    const item = document.createElement('li');
    item.textContent = message;
    node('request-log').prepend(item);
    if (node('request-log').children.length > 30) node('request-log').lastElementChild.remove();
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
    node('remote-message').textContent = 'Loading results…';
});
$.addEvent('#remote-table', 'draw.ui.table', () => {
    node('remote-message').textContent = 'Results ready.';
});
$.addEvent('#remote-table', 'error.ui.table', (event) => {
    node('remote-message').textContent = event.detail.error.message;
});
const remote = init('remote-table', { getResults, debounce: 100 });
node('fail-request').addEventListener('click', () => {
    failNext = true; remote.reload();
});
node('retry-request').addEventListener('click', () => {
    remote.search('');
});
node('replace-request').addEventListener('click', () => {
    remote.search('Alice');
    setTimeout(() => remote.search('Bob'), 200);
});

const methods = {
    init: [], addRow: [['Morgan', 'Support', 97]], clear: [], dispose: [],
    getColumn: [2], getRow: [0], getValue: [0, 2], hideColumn: [1], info: [],
    length: [10], loading: [{ show: true }], order: [[[2, 'desc']]], page: [2],
    refresh: [], reload: [{ reset: true }], removeRow: [0], search: ['Alice'],
    setColumn: [2, [10, 20, 30, 40, 50]], setRow: [0, ['Morgan', 'Support', 97]],
    setValue: [0, 2, 99], showColumn: [1],
};
for (const method of Object.keys(methods)) {
    const option = document.createElement('option');
    option.value = method;
    option.textContent = `${method}()`;
    node('method').append(option);
}
const eventNames = ['init', 'length', 'order', 'page', 'search', 'processing', 'processed', 'preDraw', 'draw', 'error'];
$.addEvent('#method-table', eventNames.map((name) => `${name}.ui.table`).join(' '), (event) => {
    const entry = document.createElement('div');
    entry.className = 'py-1 border-bottom';
    entry.textContent = `${event.type}.ui.table`;
    const log = node('event-log');
    log.append(entry);
    if (log.children.length > 50) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
});
let methodTable = init('method-table');
node('method').addEventListener('change', () => {
    node('method-args').value = JSON.stringify(methods[node('method').value]);
});
node('run-method').addEventListener('click', () => {
    try {
        const method = node('method').value;
        const args = JSON.parse(node('method-args').value);
        if (!Array.isArray(args)) throw new TypeError('Arguments must be a JSON array.');
        if (method === 'init') {
            methodTable = init('method-table', args[0]);
            node('method-output').textContent = 'Initialized.';
            return;
        }
        if (!methodTable.node) throw new Error('Choose init() to initialize the table again.');
        const result = methodTable[method](...args);
        node('method-output').textContent = result === undefined ? `${method}() completed.` : JSON.stringify(result, null, 2);
    } catch (error) {
        node('method-output').textContent = error.message;
    }
});
node('clear-log').addEventListener('click', () => node('event-log').replaceChildren());
