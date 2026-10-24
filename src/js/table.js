import $ from '@fr0st/query';
import { BaseComponent, Dropdown, generateId } from '@fr0st/ui';
import { csv, excel, print } from './buttons.js';
import {
    buildTable, copyRowValue, getDomData, getDomHeadings, getFooterCells, matchesFilter, normalizeColumns, normalizeFilters,
    normalizeOrder, normalizePageLength, normalizeSortValue, normalizeState, validateColumnIndex, validateRowId, validateRows,
} from './helpers.js';

/** @typedef {Array<*>|Record<string, *>} TableRow */
/** @typedef {string|number} TableRowId */
/** @typedef {[number, 'asc'|'desc']} TableOrder */
/**
 * @typedef {object} TableState
 * @property {1} version The snapshot schema version.
 * @property {string} search The global search term.
 * @property {TableFilter[]} filters The structured column filters.
 * @property {TableOrder[]} order The active order, empty when ordering is disabled.
 * @property {number|null} length The page length, or null when paging is disabled.
 * @property {number} page The one-based page, or one when paging is disabled.
 * @property {Array<{data: string|number, name: string|null, visible: boolean}>} columns Column identity and visibility.
 */
/**
 * @typedef {object} TableFilter
 * @property {number} column The original column index.
 * @property {'contains'|'equals'|'gt'|'gte'|'lt'|'lte'|'between'} operator The comparison.
 * @property {string|number|boolean|null|Array<string|number>} value The scalar value or inclusive bounds.
 */
/**
 * @typedef {object} TableValueContext
 * @property {'display'|'sort'|'filter'|'export'} purpose The operation requesting a value.
 * @property {TableRow} row The source row.
 * @property {number} column The original column index.
 * @property {number} rowIndex The loaded-data index.
 */
/**
 * @typedef {object} TableColumn
 * @property {string|number} [data] The row key or dot path; defaults to the column index.
 * @property {string|null} [name=null] The remote column name.
 * @property {string|null} [class=null] The cell classes.
 * @property {'asc'|'desc'} [dir='asc'] The first sort direction.
 * @property {number[]|null} [orderData=null] Alternate sort column indexes.
 * @property {boolean} [orderable=true] Whether the column can be sorted.
 * @property {number|null} [responsivePriority=1000] Lower priorities remain visible longer; null prevents collapse.
 * @property {boolean} [searchable=true] Whether local searches include the column.
 * @property {boolean} [visible=true] Whether the column is displayed.
 * @property {function(*): *} [format] Formats a cell value as HTML.
 * @property {function(*, TableValueContext): *} [render] Resolves a value for each operation; cannot accompany format.
 * @property {'auto'|'string'|'number'|'date'} [type='auto'] The local sort value type.
 * @property {function(*, *, {column: number}): number} [compare] Compares resolved sort values in ascending order.
 * @property {function(HTMLTableCellElement, *, TableRow, number, number): void} [createdCell] Receives a created cell.
 */
/**
 * @typedef {object} TableDetailColumn
 * @property {number} column The original column index.
 * @property {string|number} data The column data key or dot path.
 * @property {string} title The plain heading text or localized fallback.
 * @property {string} html The sanitized display value.
 */
/**
 * @typedef {object} TableDetailContext
 * @property {number} rowIndex The loaded-data index.
 * @property {TableDetailColumn[]} columns The collapsed, configured-visible columns in original order.
 */
/**
 * @typedef {object} TableButton
 * @property {string} [type] The registered button type.
 * @property {string} [text] The button label.
 * @property {string} [title] The export title, defaulting to the document title.
 * @property {number[]} [columns] Export columns (visible by default), or picker entries (all by default).
 * @property {'page'|'filtered'|'all'} [scope='page'] The rows to export; remote data supports page only.
 * @property {boolean} [escapeFormulae=true] Prefixes formula-like CSV strings with an apostrophe.
 * @property {function(this: Table): void} [callback] Runs with the table as its receiver.
 */
/**
 * @typedef {object} TableRequest
 * @property {string} [term] The search term, omitted when empty.
 * @property {TableFilter[]} [filters] The structured filters, omitted when empty.
 * @property {Record<number, {column: number, dir: string}>} [order] Remote ordering.
 * @property {Record<number, {data: string|number, name?: string, orderable: boolean, searchable: boolean}>} columns The column definitions.
 * @property {number} [offset] The zero-based offset when paging is enabled.
 * @property {number} [limit] The page length when paging is enabled.
 */
/**
 * @typedef {object} TableResults
 * @property {TableRow[]} results The rows for the requested page.
 * @property {number} total The total number of rows before filtering.
 * @property {number} filtered The total number of matching rows.
 */
/**
 * @typedef {object} TableOptions
 * @property {TableRow[]} [data] Local data; otherwise read the table body.
 * @property {function(TableRequest): (TableResults|PromiseLike<TableResults>)} [getResults] Loads remote rows.
 * @property {string|number|function(TableRow): TableRowId|null} [rowId=null] The stable row identity accessor.
 * @property {false|'single'|'multiple'} [selection=false] The row selection mode; requires rowId.
 * @property {TableColumn[]|null} [columns=null] The column definitions.
 * @property {function(string): string} [sanitize] Sanitizes HTML cells, headings, and custom details; defaults to query sanitization.
 * @property {TableButton[]} [buttons=[]] The export and custom buttons.
 * @property {{top?: string, bottom?: string}} [layout] Comma-separated columns containing pipe-separated controls.
 * @property {Record<string, string|Record<string, string>>} [lang] The interface labels.
 * @property {Record<string, string>} [icons] The pagination icons.
 * @property {'filled'|'outline'} [inputStyle='filled'] The generated input style.
 * @property {TableOrder[]} [order] The initial ordering; defaults to column zero ascending.
 * @property {number[]} [lengths] Available page lengths; defaults to 10, 25, 50, and 100.
 * @property {number} [length=10] The initial page length.
 * @property {number} [debounce=250] The local search or remote request delay in milliseconds.
 * @property {boolean} [info=true] Whether to render result counts.
 * @property {boolean} [lengthChange=true] Whether users can change the page length.
 * @property {boolean} [ordering=true] Whether rows can be sorted.
 * @property {boolean} [paging=true] Whether rows are paginated.
 * @property {function(this: Table, TableRow, TableDetailContext): string} [renderDetails=null] Returns custom detail HTML synchronously.
 * @property {boolean} [responsive=false] Collapse columns into details when the container is too narrow.
 * @property {boolean} [searching=true] Whether rows can be searched.
 * @property {function(HTMLTableRowElement, TableRow, number): void} [createdRow] Receives an inserted row.
 * @property {function(HTMLTableRowElement, TableRow, number, number, number): void} [rowCallback] Receives a rendered row and its indexes.
 * @property {function(HTMLTableRowElement, TableRow[], number, number, number[]): void} [headerCallback] Receives the heading row and data range.
 * @property {function(HTMLTableSectionElement, TableRow[], number, number, number[]): void} [footerCallback] Receives the footer and data range.
 * @property {function(number, number, number, number, string): string} [infoCallback] Formats the result count text.
 * @property {function(): (boolean|void)} [preDrawCallback] Runs before drawing; return false to keep the existing DOM.
 * @property {function(): void} [drawCallback] Runs after drawing rows.
 */

/**
 * Controls a sortable, searchable table with local or remote rows.
 * @augments {BaseComponent<TableOptions>}
 */
export default class Table extends BaseComponent {
    // Table buttons
    static buttons = {
        columns(options, button) {
            Dropdown.init(button).toggle();
        },
        csv(options) {
            const data = this.getExportData(options);

            if (data) {
                csv(options, data);
            }
        },
        excel(options) {
            const data = this.getExportData(options);

            if (data) {
                excel(options, data);
            }
        },
        print(options) {
            const data = this.getExportData(options);

            if (!data) {
                return;
            }

            const { headings, rows } = data;
            const table = buildTable(headings, rows, $.css(this.node, 'direction'));
            print(options, table, $.getAttribute(this.node, 'class'));
        },
    };
    // Table classes
    static classes = {
        bottomRow: 'd-md-flex align-items-center justify-content-between',
        button: 'btn btn-table btn-sm',
        buttonGroup: 'btn-group',
        column: 'd-md-flex align-items-center',
        columnContainer: 'd-flex align-items-center justify-content-center text-center px-2 mb-1',
        columnPicker: 'dropdown-menu p-3',
        columnPickerButton: 'dropdown-toggle',
        columnPickerGroup: 'btn-group',
        columnPickerInput: 'input-check',
        columnPickerLabel: 'form-check mb-1',
        columnPickerText: 'form-check-label',
        container: 'position-relative mb-2',
        detailButton: 'btn btn-table btn-sm table-details-toggle',
        detailCell: 'table-details-control text-center',
        detailList: 'table-details-list',
        detailRow: 'table-details',
        emptyCell: 'text-center py-3',
        infoContainer: 'text-center text-md-start w-100',
        lengthContainer: 'd-flex justify-content-center justify-content-md-start w-100',
        lengthInputContainer: 'form-input',
        lengthInputFilled: 'input-filled input-sm',
        lengthInputOutline: 'input-outline input-sm',
        lengthLabel: 'd-inline-flex align-items-center mb-0',
        lengthLabelText: 'me-2',
        loader: 'position-absolute top-50 start-50 translate-middle z-1',
        loaderIcon: 'spinner-border text-primary',
        pageActive: 'active',
        pageDisabled: 'disabled',
        pageItem: 'page-item',
        pageLink: 'page-link ripple',
        pagination: 'pagination pagination-sm mx-auto me-md-0',
        paginationContainer: 'd-flex w-100',
        searchContainer: 'w-100',
        searchInputContainer: 'form-input mx-auto me-md-0',
        searchInputFilled: 'input-filled input-sm',
        searchInputOutline: 'input-outline input-sm',
        selectedRow: 'table-active',
        selectionCell: 'text-center',
        selectionContainer: 'd-flex align-items-center gap-2',
        selectionInput: 'input-check',
        table: 'table table-bordered',
        tableContainer: 'table-responsive',
        tableHeading: 'fw-bold',
        tableSort: 'table-sort',
        tableSortAsc: 'table-sort-asc',
        tableSortDesc: 'table-sort-desc',
        topRow: 'd-md-flex align-items-center justify-content-between mb-2',
    };
    /** @type {TableOptions} */
    static defaults = {
        buttons: [],
        layout: {
            top: 'search,buttons|length',
            bottom: 'info,pagination',
        },
        lang: {
            column: 'Column {column}',
            info: 'Showing results {start} to {end} of {total}',
            infoFiltered: 'Showing results {start} to {end} of {filtered} (filtered from {total} total)',
            noData: 'No data available',
            noResults: 'No results to show',
            page: 'Page',
            perPage: 'Per Page',
            search: 'Search',
            responsive: {
                details: 'Details',
                hide: 'Hide details for row {row}',
                show: 'Show details for row {row}',
            },
            selection: {
                clear: 'Clear selection',
                count: '{count} selected',
                page: 'Select all rows on this page',
                row: 'Select row {id}',
            },
            loading: 'Loading results',
            paginate: {
                first: 'First',
                last: 'Last',
                next: 'Next',
                previous: 'Previous',
            },
            buttons: {
                columns: 'Columns',
                csv: 'CSV',
                excel: 'Excel',
                print: 'Print',
            },
            aria: {
                sortAscending: ': activate to sort column ascending',
                sortDescending: ': activate to sort column descending',
            },
        },
        icons: {
            first: '&laquo;',
            last: '&raquo;',
            next: '&gt;',
            previous: '&lt;',
        },
        sanitize: (html) => $.sanitize(html),
        inputStyle: 'filled',
        createdRow: null,
        drawCallback: null,
        footerCallback: null,
        headerCallback: null,
        infoCallback: null,
        preDrawCallback: null,
        renderDetails: null,
        rowCallback: null,
        rowId: null,
        selection: false,
        columns: null,
        order: [[0, 'asc']],
        lengths: [10, 25, 50, 100],
        length: 10,
        debounce: 250,
        info: true,
        lengthChange: true,
        ordering: true,
        paging: true,
        responsive: false,
        searching: true,
    };
    // Table layout
    static layout = {
        buttons(container) {
            this.#renderButtons(container);
        },
        search(container) {
            this.#renderSearch(container);
        },
        selection(container) {
            this.#renderSelection(container);
        },
        length(container) {
            this.#renderLengthSelect(container);
        },
        info(container) {
            this.#renderInfoContainer(container);
        },
        pagination(container) {
            this.#renderPaginationContainer(container);
        },
    };

    #collapsedColumns = new Set();
    #columnPickers = [];
    #columns = [];
    #container = null;
    #data = [];
    #domValues = new WeakMap();
    #drawVersion = 0;
    #emptyCell = null;
    #expandedRows = new Set();
    #filtered = 0;
    #filteredIndexes = [];
    #filters = [];
    #footerCells = [];
    #headings = [];
    #id = false;
    #infoContainer = null;
    #lengthSelect = null;
    #limit;
    #loader = null;
    #loadResults = null;
    #notifiedSelectedIds = new Set();
    #offset = 0;
    #order;
    #original = null;
    #originalBusy;
    #originalClass;
    #originalDescription;
    #page;
    #pagination = null;
    #pending = null;
    #requestVersion = 0;
    #responsiveFooterCells = [];
    #responsiveFrame = null;
    #responsiveHeading = null;
    #responsiveObserver = null;
    #responsiveRows = [];
    #responsiveWidth = null;
    #results = [];
    #rowFilter = null;
    #rowIdIndexes = new Map();
    #rowIds = [];
    #rowIndexes = [];
    #searchHandler = null;
    #searchInput = null;
    #selectedIds = new Set();
    #selectionClear = null;
    #selectionCount = null;
    #selectionHeading = null;
    #selectionInputs = new WeakMap();
    #selectionName = null;
    #stateKey = null;
    #tableContainer = null;
    #tbody = null;
    #term = '';
    #tfoot = null;
    #theadRow = null;
    #total = 0;
    #totalPages;

    /**
     * Creates a Table.
     * @param {HTMLTableElement} node The input table.
     * @param {TableOptions} [options] The component options.
     */
    constructor(node, options) {
        if (!$._isElement(node) || !$.is(node, 'table')) {
            throw new TypeError('Table must be created on a table element.');
        }

        super(node, options);

        try {
            this.#originalClass = $.getAttribute(node, 'class');
            this.#originalDescription = $.getAttribute(node, 'aria-describedby');
            this.#originalBusy = $.getAttribute(node, 'aria-busy');

            this.#limit = this.options.paging ? normalizePageLength(this.options.length) : Infinity;

            for (const length of this.options.lengths) {
                normalizePageLength(length);
            }

            const rowId = this.options.rowId;

            if (rowId !== null && typeof rowId !== 'function' &&
                (typeof rowId !== 'string' || !rowId.length) &&
                (!Number.isSafeInteger(rowId) || rowId < 0)) {
                throw new TypeError('Row ID must be a data key, callback, or null.');
            }

            if (![false, 'single', 'multiple'].includes(this.options.selection) ||
                (this.options.selection && rowId === null)) {
                throw new TypeError('Selection must be false, single, or multiple and requires rowId.');
            }

            if (typeof this.options.responsive !== 'boolean') {
                throw new TypeError('Responsive must be a boolean.');
            }

            if (this.options.renderDetails !== null && typeof this.options.renderDetails !== 'function') {
                throw new TypeError('Details renderer must be a function or null.');
            }

            this.#selectionName = generateId('table-selection');

            if (!this.options.getResults) {
                const data = this.options.data ?? getDomData(node, this.#domValues);
                validateRows(data);

                if (!this.#setData(data.slice())) {
                    return;
                }
            }

            const headings = getDomHeadings(node);
            this.#columns = normalizeColumns(this.options.columns, headings);
            this.#headings = headings;

            if (!headings.length) {
                this.#headings = this.#columns.map((column) => ({
                    text: column.name ?? String(column.data),
                    class: null,
                }));
            }

            this.#order = normalizeOrder(this.options.order, this.#columns);
            this.#stateKey = JSON.stringify(this.getState());

            if (!$.getProperty(node, 'id')) {
                $.setProperty(node, 'id', generateId('table'));
                this.#id = true;
            }

            if (this.options.getResults) {
                this.#loadResults = $._debounce(
                    (version) => this.#fetchResults(version),
                    this.options.debounce,
                );
            }

            this.#render();

            if (!this.node) {
                return;
            }

            this.#events();
            $.triggerEvent(this.node, 'init.ui.table');

            if (this.node) {
                this.#load();
            }
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    /**
     * Adds a row to the data array.
     * @param {Array|object} row The row to add.
     */
    addRow(row) {
        if (!this.node) {
            return;
        }

        validateRows([row]);
        const data = [...this.#data, Array.isArray(row) ? [...row] : { ...row }];

        if (!this.#setData(data)) {
            return;
        }

        this.#mutated(1);
    }

    /**
     * Adds copied rows to a local dataset with one redraw.
     * @param {TableRow[]} rows The rows to append.
     */
    addRows(rows) {
        if (!this.node) {
            return;
        }

        if (this.options.getResults) {
            throw new TypeError('Bulk updates require local data.');
        }

        validateRows(rows);

        if (!rows.length) {
            return;
        }

        const data = rows.map((row) => Array.isArray(row) ? [...row] : { ...row });

        if (!this.#setData(this.#data.concat(data))) {
            return;
        }

        this.#load();
    }

    /**
     * Clears all rows from the data array.
     */
    clear() {
        if (!this.node) {
            return;
        }

        const requestVersion = this.#cancelRequest();

        if (!this.node || requestVersion !== this.#requestVersion) {
            return;
        }

        this.#searchHandler?.cancel();
        this.#data = [];
        this.#rowIdIndexes.clear();
        this.#rowIds = [];
        this.#selectedIds.clear();
        this.#domValues = new WeakMap();
        this.#results = [];
        this.#rowIndexes = [];
        this.#offset = 0;
        this.#total = 0;
        this.#filtered = 0;
        this.#filteredIndexes = [];
        this.#filters = [];
        this.#rowFilter = null;
        this.#term = '';

        if (this.#searchInput) {
            $.setValue(this.#searchInput, '');
        }

        this.#refreshResults();
        this.loading({ show: false });

        if (this.node) {
            this.#renderResults();
        }
    }

    /**
     * Removes selected IDs in a data scope without changing the view.
     * @param {object} [options] Options for selecting rows.
     * @param {'page'|'filtered'|'all'} [options.scope='page'] The row scope.
     */
    deselectRows({ scope = 'page' } = {}) {
        this.#selectScope(scope, false);
    }

    /** @inheritdoc */
    dispose() {
        if (!this.node) {
            return;
        }

        const node = this.node;

        this.#drawVersion++;
        this.#searchHandler?.cancel();
        this.#requestVersion++;
        this.#loadResults?.cancel();
        this.#responsiveObserver?.disconnect();
        if (this.#responsiveFrame !== null) {
            cancelAnimationFrame(this.#responsiveFrame);
        }

        const pending = this.#pending;
        this.#pending = null;

        // Clear the instance first so DOM removal events cannot dispose it again.
        super.dispose();

        for (const { dropdown } of this.#columnPickers) {
            dropdown.dispose();
        }

        this.#collapsedColumns.clear();
        this.#columnPickers = [];
        this.#emptyCell = null;
        this.#expandedRows.clear();
        this.#footerCells = [];
        this.#responsiveFooterCells = [];
        this.#responsiveFrame = null;
        this.#responsiveHeading = null;
        this.#responsiveObserver = null;
        this.#responsiveRows = [];
        this.#responsiveWidth = null;
        this.#tableContainer = null;

        if (this.#id) {
            $.removeAttribute(node, 'id');
        }

        for (const [attribute, value] of [
            ['class', this.#originalClass],
            ['aria-describedby', this.#originalDescription],
            ['aria-busy', this.#originalBusy],
        ]) {
            if (value === undefined) {
                continue;
            }

            if (value === null) {
                $.removeAttribute(node, attribute);
            } else {
                $.setAttribute(node, { [attribute]: value });
            }
        }

        if (this.#container) {
            $.before(this.#container, node);
            $.remove(this.#container);
        }

        if (this.#original) {
            $.empty(node);
            $.append(node, this.#original);
        }

        this.#original = null;
        this.#container = null;
        this.#loader = null;
        this.#theadRow = null;
        this.#tbody = null;
        this.#tfoot = null;
        this.#infoContainer = null;
        this.#pagination = null;
        this.#lengthSelect = null;
        this.#searchInput = null;
        this.#selectionClear = null;
        this.#selectionCount = null;
        this.#selectionHeading = null;
        this.#selectionInputs = new WeakMap();
        this.#selectionName = null;
        this.#notifiedSelectedIds.clear();

        this.#columns = [];
        this.#headings = [];
        this.#data = [];
        this.#rowIdIndexes.clear();
        this.#rowIds = [];
        this.#selectedIds.clear();
        this.#domValues = new WeakMap();
        this.#results = [];
        this.#rowIndexes = [];

        this.#filteredIndexes = [];
        this.#filters = [];
        this.#rowFilter = null;

        this.#loadResults = null;
        this.#searchHandler = null;
        this.#stateKey = null;

        // Restore the DOM before a user cancellation hook can initialize a new instance.
        try {
            pending?.cancel?.();
        } catch {
            // Disposing still succeeds if a cancellation hook throws.
        }
    }

    /**
     * Gets values for a single column.
     * @param {string} key The key to retrieve.
     * @param {object} [options] Options for getting the column.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {Array} The column values.
     */
    getColumn(key, { modified = true } = {}) {
        return modified ?
            this.#rowIndexes.map((rowIndex) => $._getDot(this.#data[rowIndex], `${key}`)) :
            this.#data.map((row) => $._getDot(row, `${key}`));
    }

    /**
     * Gets copied rows in the active order without changing the current view.
     * @param {object} [options] Options for selecting rows.
     * @param {'page'|'filtered'|'all'} [options.scope='page'] The row scope.
     * @returns {TableRow[]} Shallow copies of the selected source rows.
     */
    getData({ scope = 'page' } = {}) {
        const indexes = this.#getDataIndexes(scope);

        return indexes.map((index) => {
            const row = this.#data[index];

            return Array.isArray(row) ? [...row] : { ...row };
        });
    }

    /**
     * Collects text headings and resolved export values without changing the view.
     * @param {object} [options] Options for collecting export data.
     * @param {'page'|'filtered'|'all'} [options.scope='page'] The row scope.
     * @param {number[]|null} [options.columns=null] Column indexes; defaults to visible columns.
     * @returns {{headings: string[], rows: Array<Array<*>>}|null} The export data, or null if interrupted.
     */
    getExportData({ scope = 'page', columns = null } = {}) {
        if (!this.node) {
            return null;
        }

        const version = this.#drawVersion;
        columns ??= this.#getVisibleColumns();

        if (!Array.isArray(columns)) {
            throw new TypeError('Export columns must be an array.');
        }

        columns = [...columns];

        for (const index of columns) {
            validateColumnIndex(index, this.#columns.length);
        }

        const indexes = this.#getDataIndexes(scope);

        if (!this.node || version !== this.#drawVersion) {
            return null;
        }

        // Exports contain text, even when the displayed headings contain HTML.
        const headings = columns.map((index) => {
            const container = $.create('div');
            $.setHtml(container, $.sanitize(String(this.#headings[index].text)));

            return $.getText(container);
        });

        const rows = [];

        for (const rowIndex of indexes) {
            const row = [];

            for (const index of columns) {
                const value = this.#getValue(rowIndex, index, 'export');

                if (!this.node || version !== this.#drawVersion) {
                    return null;
                }

                row.push(value);
            }

            rows.push(row);
        }

        return { headings, rows };
    }

    /**
     * Gets values for a single row.
     * @param {number} index The row index to retrieve.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {TableRow} A shallow copy of the row.
     */
    getRow(index, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });

        return $._isPlainObject(this.#data[rowIndex]) ?
            { ...this.#data[rowIndex] } :
            [...this.#data[rowIndex]];
    }

    /**
     * Gets a loaded row by stable identity.
     * @param {TableRowId} id The row ID.
     * @returns {TableRow|null} A shallow row copy, or null when absent.
     */
    getRowById(id) {
        const index = this.#getIdIndex(id);

        return index === undefined ? null : this.getRow(index, { modified: false });
    }

    /**
     * Gets the stable identity for a positional row.
     * @param {number} index The row index.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {TableRowId|null} The row ID, or null after disposal.
     */
    getRowId(index, { modified = true } = {}) {
        if (!this.node) {
            return null;
        }

        if (this.options.rowId === null) {
            throw new TypeError('Row identity requires rowId.');
        }

        return this.#rowIds[this.#getIndex(index, { modified })];
    }

    /**
     * Gets an independent selection in insertion order, including unloaded IDs.
     * @returns {TableRowId[]} The selected IDs.
     */
    getSelectedIds() {
        return [...this.#selectedIds];
    }

    /**
     * Gets an independent, serializable snapshot of the current view.
     * @returns {TableState|null} The snapshot, or null after disposal.
     */
    getState() {
        if (!this.node) {
            return null;
        }

        return {
            version: 1,
            search: this.#term,
            filters: this.#filters.map((filter) => ({
                ...filter,
                value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
            })),
            order: this.options.ordering ? this.#order.map((entry) => [...entry]) : [],
            length: this.options.paging ? this.#limit : null,
            page: this.options.paging ? 1 + this.#offset / this.#limit : 1,
            columns: this.#columns.map((column) => ({
                data: column.data,
                name: column.name ?? null,
                visible: Boolean(column.visible),
            })),
        };
    }

    /**
     * Gets a single value from a row.
     * @param {number} index The row index to retrieve.
     * @param {string} key The key to retrieve.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {*} The value.
     */
    getValue(index, key, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });

        return $._getDot(this.#data[rowIndex], `${key}`);
    }

    /**
     * Toggles a column as hidden.
     * @param {number} index The column index.
     */
    hideColumn(index) {
        validateColumnIndex(index, this.#columns.length);
        this.#columns[index].visible = false;
        this.#renderResults();
    }

    /**
     * Gets the Table information.
     * @returns {object} The Table information.
     */
    info() {
        return {
            end: this.#offset + this.#results.length,
            filtered: this.#filtered,
            start: this.#offset,
            total: this.#total,
        };
    }

    /**
     * Sets the Table length.
     * @param {number} length The length.
     */
    length(length) {
        if (!this.node || !this.options.paging) {
            return;
        }

        length = normalizePageLength(length);

        this.#limit = length;
        this.#offset -= this.#offset % length;
        this.#syncLength();
        $.triggerEvent(this.node, 'length.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Triggers the loading indicator.
     * @param {object} [options] Options for the loading indicator.
     * @param {boolean} [options.show=true] Whether to show the loading indicator.
     */
    loading({ show = true } = {}) {
        if (!this.node) {
            return;
        }

        $.setAttribute(this.node, { 'aria-busy': String(show) });

        if (show) {
            $.show(this.#loader);
            $.triggerEvent(this.node, 'processing.ui.table');
        } else {
            $.hide(this.#loader);
            $.triggerEvent(this.node, 'processed.ui.table');
        }
    }

    /**
     * Sets the Table order data.
     * @param {Array} order The order data.
     */
    order(order) {
        if (!this.node || !this.options.ordering) {
            return;
        }

        this.#order = normalizeOrder(order, this.#columns);
        $.triggerEvent(this.node, 'order.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Sets the Table page.
     * @param {number} page The one-based page number.
     */
    page(page) {
        if (!this.node || !this.options.paging) {
            return;
        }

        page = Number(page);

        if (!Number.isSafeInteger(page)) {
            throw new RangeError('Page must be an integer.');
        }

        const pages = Math.max(1, Math.ceil(this.#filtered / this.#limit));
        this.#offset = (Math.min(pages, Math.max(1, page)) - 1) * this.#limit;
        $.triggerEvent(this.node, 'page.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Redraws the Table.
     */
    refresh() {
        this.#renderResults();
    }

    /**
     * Reloads the Table data.
     * @param {object} [options] Options for reloading the data
     * @param {boolean} [options.reset=false] Whether to reset the offset.
     */
    reload({ reset = false } = {}) {
        if (!this.node) {
            return;
        }

        if (reset) {
            this.#offset = 0;
        }

        this.#load();
    }

    /**
     * Removes a row from the data array.
     * @param {number} index The row index to remove.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    removeRow(index, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });
        const id = this.#rowIds[rowIndex];
        const data = this.#data.filter((_, index) => index !== rowIndex);

        if (!this.#setData(data)) {
            return;
        }

        this.#selectedIds.delete(id);
        this.#mutated(-1);
    }

    /**
     * Removes a loaded row by stable identity.
     * @param {TableRowId} id The row ID.
     */
    removeRowById(id) {
        if (this.node) {
            this.removeRow(this.#getIdIndex(id), { modified: false });
        }
    }

    /**
     * Searches the Table for a term.
     * @param {string} term The term to search for.
     */
    search(term) {
        if (!this.node || !this.options.searching) {
            return;
        }

        this.#searchHandler?.cancel();
        this.#term = String(term ?? '');
        this.#offset = 0;

        if (this.#searchInput) {
            $.setValue(this.#searchInput, this.#term);
        }

        $.triggerEvent(this.node, 'search.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Adds selected IDs in a data scope without changing the view.
     * @param {object} [options] Options for selecting rows.
     * @param {'page'|'filtered'|'all'} [options.scope='page'] The row scope.
     */
    selectRows({ scope = 'page' } = {}) {
        this.#selectScope(scope, true);
    }

    /**
     * Sets values for a single column.
     * @param {string} key The key to set.
     * @param {Array} column The column values.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setColumn(key, column, { modified = true } = {}) {
        const indexes = modified ? this.#rowIndexes : this.#data.map((_, index) => index);

        if (!Array.isArray(column) || column.length !== indexes.length) {
            throw new RangeError('Column values must match the selected row count.');
        }

        this.#setValues(indexes, String(key), column);
    }

    /**
     * Replaces a local dataset with copied rows and one redraw.
     * @param {TableRow[]} rows The replacement rows.
     * @param {object} [options] Options for replacing the dataset.
     * @param {boolean} [options.resetPage=true] Whether to reset to the first page.
     */
    setData(rows, { resetPage = true } = {}) {
        if (!this.node) {
            return;
        }

        if (this.options.getResults) {
            throw new TypeError('Bulk updates require local data.');
        }

        validateRows(rows);
        const data = rows.map((row) => Array.isArray(row) ? [...row] : { ...row });

        if (!this.#setData(data)) {
            return;
        }

        this.#domValues = new WeakMap();
        this.#filteredIndexes = [];
        this.#rowIndexes = [];
        this.#results = [];

        if (resetPage) {
            this.#offset = 0;
        }

        this.#load();
    }

    /**
     * Replaces structured column filters and resets to the first page.
     * @param {TableFilter[]} filters The filters to apply together.
     */
    setFilters(filters) {
        if (!this.node || !this.options.searching) {
            return;
        }

        this.#filters = normalizeFilters(filters, this.#columns);
        this.#offset = 0;
        $.triggerEvent(this.node, 'filter.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Sets values for a single row.
     * @param {number} index The row index to set.
     * @param {Array|object} row The row values.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setRow(index, row, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });
        validateRows([row]);
        const data = [...this.#data];
        data[rowIndex] = Array.isArray(row) ? [...row] : { ...row };

        if (this.#setData(data, { preserveIds: true })) {
            this.#mutated();
        }
    }

    /**
     * Replaces a loaded row while preserving its identity.
     * @param {TableRowId} id The row ID.
     * @param {TableRow} row The replacement row.
     */
    setRowById(id, row) {
        if (this.node) {
            this.setRow(this.#getIdIndex(id), row, { modified: false });
        }
    }

    /**
     * Sets a local row predicate and resets to the first page.
     * @param {function(TableRow): boolean|null} predicate The predicate, or null to clear it.
     */
    setRowFilter(predicate) {
        if (!this.node || !this.options.searching) {
            return;
        }

        if (predicate !== null && typeof predicate !== 'function') {
            throw new TypeError('Row filter must be a function or null.');
        }

        if (predicate !== null && this.options.getResults) {
            throw new TypeError('Row filters require local data.');
        }

        this.#rowFilter = predicate;
        this.#offset = 0;
        $.triggerEvent(this.node, 'filter.ui.table');

        if (this.node) {
            this.#load();
        }
    }

    /**
     * Replaces the selection atomically without drawing or requesting data.
     * @param {TableRowId[]} ids The selected IDs; an empty array clears selection.
     */
    setSelectedIds(ids) {
        if (!this.node) {
            return;
        }

        if (!this.options.selection) {
            throw new TypeError('Row selection is disabled.');
        }

        if (!Array.isArray(ids)) {
            throw new TypeError('Selected IDs must be an array.');
        }

        const selected = new Set(ids);

        for (const id of selected) {
            validateRowId(id);

            if (!this.options.getResults && !this.#rowIdIndexes.has(id)) {
                throw new RangeError('Selected row ID is not in the dataset.');
            }
        }

        if (this.options.selection === 'single' && selected.size > 1) {
            throw new RangeError('Single selection accepts only one row.');
        }

        // Reordering an equivalent set does not change selection insertion order.
        if (selected.size === this.#selectedIds.size && [...selected].every((id) => this.#selectedIds.has(id))) {
            return;
        }

        this.#selectedIds = selected;
        this.#syncSelection();
        this.#notifySelectionChange();
    }

    /**
     * Restores a validated view with one recalculation or remote load.
     * @param {TableState} state The complete snapshot to restore.
     */
    setState(state) {
        if (!this.node) {
            return;
        }

        const normalized = normalizeState(state, this.#columns, this.options);
        this.#searchHandler?.cancel();

        this.#term = normalized.search;
        this.#filters = normalized.filters;
        this.#order = normalized.order;
        this.#limit = normalized.length ?? Infinity;
        this.#offset = this.options.paging ? (normalized.page - 1) * this.#limit : 0;

        for (const [index, column] of normalized.columns.entries()) {
            this.#columns[index].visible = column.visible;
        }

        if (this.#searchInput) {
            $.setValue(this.#searchInput, this.#term);
        }

        this.#syncColumnPickers();
        this.#syncLength();
        this.#load();
    }

    /**
     * Sets a single value for a row.
     * @param {number} index The row index to set.
     * @param {string} key The key to set.
     * @param {*} value The value to set.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setValue(index, key, value, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });
        this.#setValues([rowIndex], String(key), [value]);
    }

    /**
     * Toggles a column as visible.
     * @param {number} index The column index.
     */
    showColumn(index) {
        validateColumnIndex(index, this.#columns.length);
        this.#columns[index].visible = true;
        this.#renderResults();
    }

    /**
     * Invalidates pending results before invoking an optional cancellation hook.
     * @returns {number} The invalidation generation.
     */
    #cancelRequest() {
        const version = ++this.#requestVersion;
        this.#loadResults?.cancel();
        const pending = this.#pending;
        this.#pending = null;

        try {
            pending?.cancel?.();
        } catch {
            // Cancellation is best effort; version checks still reject stale results.
        }

        return version;
    }

    /**
     * Attaches events for the Table.
     */
    #events() {
        if (this.#lengthSelect) {
            $.addEvent(this.#lengthSelect, 'change.ui.table', () => {
                const length = $.getValue(this.#lengthSelect);
                this.length(length);
            });
        }

        if (this.#searchInput) {
            this.#searchHandler = $._debounce(() => {
                if (this.node) {
                    this.search($.getValue(this.#searchInput));
                }
            }, this.options.getResults ? 0 : this.options.debounce);
            $.addEvent(this.#searchInput, 'input.ui.table', this.#searchHandler);
        }

        if (this.options.ordering) {
            const handleSort = (event) => {
                const index = Number($.getDataset(event.currentTarget, 'uiIndex'));

                if (!this.#columns[index].orderable) {
                    return;
                }

                event.preventDefault();

                const defaultDir = this.#columns[index].dir;
                const currentDir = this.#order.find(([column]) => column === index)?.[1];

                let nextDir = defaultDir;

                if (currentDir === defaultDir) {
                    nextDir = defaultDir === 'asc' ?
                        'desc' :
                        'asc';
                }

                let order;

                if (event.shiftKey) {
                    if (!currentDir) {
                        order = [...this.#order, [index, nextDir]];
                    } else if (currentDir === defaultDir) {
                        order = this.#order.map(([column, direction]) => [
                            column,
                            column === index ? nextDir : direction,
                        ]);
                    } else {
                        order = this.#order.filter(([column]) => column !== index);
                    }
                } else {
                    order = [[index, nextDir]];
                }

                this.order(order);
            };

            $.addEventDelegate(this.#theadRow, 'click.ui.table', 'th[data-ui-index]', handleSort);

            $.addEventDelegate(this.#theadRow, 'keydown.ui.table', 'th[data-ui-index]', (event) => {
                switch (event.code) {
                    case 'Enter':
                    case 'NumpadEnter':
                    case 'Space':
                        handleSort(event);
                        break;
                }
            });
        }

        if (this.options.responsive) {
            this.#responsiveObserver = new ResizeObserver(([entry]) => {
                if (entry.contentRect.width !== this.#responsiveWidth) {
                    this.#responsiveWidth = entry.contentRect.width;
                    this.#scheduleResponsive();
                }
            });
            this.#responsiveObserver.observe(this.#tableContainer);
            document.fonts.ready.then(() => this.#scheduleResponsive());
        }

        if (this.options.selection) {
            $.addEventDelegate(this.#theadRow, 'change.ui.table', '[data-ui-select-page]', (event) => {
                if ($.getProperty(event.currentTarget, 'checked')) {
                    this.selectRows();
                } else {
                    this.deselectRows();
                }
            });

            $.addEventDelegate(this.#tbody, 'change.ui.table', '[data-ui-select-row]', (event) => {
                const id = this.#selectionInputs.get(event.currentTarget);
                const selected = this.options.selection === 'single' ? new Set() : new Set(this.#selectedIds);

                if ($.getProperty(event.currentTarget, 'checked')) {
                    selected.add(id);
                } else {
                    selected.delete(id);
                }

                this.setSelectedIds([...selected]);
            });
        }

        if (this.#pagination) {
            $.addEventDelegate(this.#pagination, 'click.ui.table', '[data-ui-page]', (event) => {
                event.preventDefault();

                if ($.getProperty(event.currentTarget, 'disabled')) {
                    return;
                }

                let page = $.getDataset(event.currentTarget, 'uiPage');

                switch (page) {
                    case 'first':
                        page = 1;
                        break;
                    case 'prev':
                        page = this.#page - 1;
                        break;
                    case 'next':
                        page = this.#page + 1;
                        break;
                    case 'last':
                        page = this.#totalPages;
                        break;
                }

                this.page(page);
            });
        }
    }

    /**
     * Loads and validates the newest remote page.
     * @param {number} version The request generation.
     * @returns {Promise<void>} Completion of the request.
     */
    async #fetchResults(version) {
        // A response is stale if a newer load began, even when cancellation is unavailable.
        const active = () => this.node && version === this.#requestVersion;

        if (!active()) {
            return;
        }

        const request = {
            columns: {},
        };

        for (const [index, column] of this.#columns.entries()) {
            request.columns[index] = {
                data: column.data,
                orderable: column.orderable,
                searchable: column.searchable,
            };

            if (column.name) {
                request.columns[index].name = column.name;
            }
        }

        if (this.#term) {
            request.term = this.#term;
        }

        if (this.#filters.length) {
            request.filters = this.#filters.map((filter) => ({
                ...filter,
                value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
            }));
        }

        if (this.options.ordering) {
            request.order = { ...this.#getOrder().map(([column, dir]) => ({ column, dir })) };
        }

        if (this.options.paging) {
            request.offset = this.#offset;
            request.limit = this.#limit;
        }

        let response;
        let identities;

        try {
            const pending = this.options.getResults.call(this, request);

            if (!active()) {
                // The callback may invalidate itself before returning a rejecting promise.
                Promise.resolve(pending).catch(() => {});
                pending?.cancel?.();

                return;
            }

            this.#pending = pending;
            response = await pending;

            if (!active()) {
                return;
            }

            validateRows(response?.results);

            if (
                !Number.isSafeInteger(response.total) ||
                !Number.isSafeInteger(response.filtered) ||
                response.total < 0 ||
                response.filtered < 0 ||
                response.filtered > response.total ||
                response.results.length > response.filtered ||
                (this.options.paging && response.results.length > this.#limit)
            ) {
                throw new TypeError('Remote counts and rows must describe a valid result page.');
            }

            identities = this.#getRowIdentities(response.results);

            if (!identities || !active()) {
                return;
            }
        } catch (error) {
            if (active()) {
                this.#pending = null;
                this.loading({ show: false });

                if (active()) {
                    $.triggerEvent(this.node, 'error.ui.table', { detail: { error } });
                }
            }

            return;
        }

        this.#pending = null;
        this.#total = response.total;
        this.#filtered = response.filtered;

        if (this.options.paging && this.#offset >= this.#filtered && this.#offset > 0) {
            // Filtering or deleting rows may leave the requested page beyond the final page.
            this.#offset = Math.max(0, (Math.ceil(this.#filtered / this.#limit) - 1) * this.#limit);
            this.#load();

            return;
        }

        this.#data = response.results.slice();
        this.#rowIdIndexes = identities;
        this.#rowIds = [...identities.keys()];
        this.#refreshResults();
        this.loading({ show: false });

        if (active()) {
            this.#renderResults();
        }
    }

    /**
     * Selects ordered row indexes without changing the current view.
     * @param {'page'|'filtered'|'all'} scope The row scope.
     * @returns {number[]} The selected indexes.
     */
    #getDataIndexes(scope) {
        if (!['page', 'filtered', 'all'].includes(scope)) {
            throw new RangeError('Data scope must be page, filtered, or all.');
        }

        if (!this.node) {
            return [];
        }

        if (scope !== 'page' && this.options.getResults) {
            throw new RangeError('Remote data supports only the page scope.');
        }

        switch (scope) {
            case 'page':
                return this.#rowIndexes;
            case 'filtered':
                return this.#filteredIndexes;
            case 'all':
                return this.#sortIndexes(this.#data.map((_, index) => index)) ?? [];
        }
    }

    /**
     * Looks up a loaded row without coercing application IDs.
     * @param {TableRowId} id The row ID.
     * @returns {number|undefined} The loaded index, or undefined when absent.
     */
    #getIdIndex(id) {
        if (!this.node) {
            return;
        }

        if (this.options.rowId === null) {
            throw new TypeError('Row identity requires rowId.');
        }

        validateRowId(id);

        return this.#rowIdIndexes.get(id);
    }

    /**
     * Gets an index (optionally modified).
     * @param {number} index The index to get.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {number} The index.
     */
    #getIndex(index, { modified = true } = {}) {
        const count = modified ? this.#rowIndexes.length : this.#data.length;

        if (!Number.isInteger(index) || index < 0 || index >= count) {
            throw new RangeError('Row index is out of range.');
        }

        return modified ? this.#rowIndexes[index] : index;
    }

    /**
     * Expands alternate sort columns, which were validated during initialization.
     * @returns {Array} The column ordering data.
     */
    #getOrder() {
        return this.#order.flatMap(([index, direction]) => {
            const columns = this.#columns[index].orderData ?? [index];

            return columns.map((column) => [column, direction]);
        });
    }

    /**
     * Counts rendered data and utility columns for spanning cells.
     * @returns {number} The span, with a minimum of one for empty tables.
     */
    #getRenderedColumnCount() {
        return Math.max(1, this.#getVisibleColumns().length - this.#collapsedColumns.size +
            Number(Boolean(this.options.selection)) + Number(this.#collapsedColumns.size > 0));
    }

    /**
     * Resolves and validates every identity before installing new data.
     * @param {TableRow[]} data The proposed dataset.
     * @returns {Map<TableRowId, number>|null} The identity map, or null if interrupted.
     */
    #getRowIdentities(data) {
        const identities = new Map();
        const accessor = this.options.rowId;
        const version = this.#drawVersion;
        const requestVersion = this.#requestVersion;

        if (accessor === null) {
            return identities;
        }

        for (const [index, row] of data.entries()) {
            const id = typeof accessor === 'function' ?
                accessor.call(this, row) :
                $._getDot(row, String(accessor));

            if (!this.node || version !== this.#drawVersion || requestVersion !== this.#requestVersion) {
                return null;
            }

            validateRowId(id);

            if (identities.has(id)) {
                throw new TypeError('Row IDs must be unique within the loaded dataset.');
            }

            identities.set(id, index);
        }

        return identities;
    }

    /**
     * Resolves a source value for one table operation.
     * @param {number} rowIndex The loaded-data index.
     * @param {number} index The original column index.
     * @param {'display'|'sort'|'filter'|'export'} purpose The operation.
     * @returns {*} The resolved value.
     */
    #getValue(rowIndex, index, purpose) {
        const row = this.#data[rowIndex];
        const column = this.#columns[index];
        const key = String(column.data);
        const value = $._getDot(row, key);

        if (column.render) {
            return column.render.call(this, value, { purpose, row, column: index, rowIndex });
        }

        if (purpose === 'display') {
            return column.format ? column.format.call(this, value) : value;
        }

        const metadata = this.#domValues.get(row)?.get(key);

        return metadata && metadata.value === value ? metadata[purpose] : value;
    }

    /**
     * Gets the visible columns.
     * @returns {Array} The visible columns.
     */
    #getVisibleColumns() {
        const columns = [];

        for (const [index, column] of this.#columns.entries()) {
            if (!column.visible) {
                continue;
            }

            columns.push(index);
        }

        return columns;
    }

    /**
     * Loads the current page from local data or schedules a remote request.
     */
    #load() {
        if (!this.node) {
            return;
        }

        const drawVersion = ++this.#drawVersion;

        // Loading events and cancellation hooks may dispose the table or start another load.
        // Only the current operation may continue after invoking them.
        if (this.options.getResults) {
            const requestVersion = this.#cancelRequest();

            if (!this.node || requestVersion !== this.#requestVersion) {
                return;
            }

            this.#syncSelection();
            this.#notifySelectionChange();

            if (!this.node || requestVersion !== this.#requestVersion) {
                return;
            }

            this.#notifyStateChange();

            if (!this.node || requestVersion !== this.#requestVersion) {
                return;
            }

            this.loading();

            if (this.node && requestVersion === this.#requestVersion) {
                this.#loadResults(requestVersion);
            }

            return;
        }

        this.loading();

        if (!this.node || drawVersion !== this.#drawVersion) {
            return;
        }

        try {
            this.#updateLocal();

            if (this.node && drawVersion === this.#drawVersion) {
                this.#syncSelection();
                this.#notifySelectionChange();
            }

            if (this.node && drawVersion === this.#drawVersion) {
                this.#notifyStateChange();
            }
        } finally {
            if (this.node && drawVersion === this.#drawVersion) {
                this.loading({ show: false });
            }
        }

        if (this.node && drawVersion === this.#drawVersion) {
            this.#renderResults();
        }
    }

    /**
     * Redraws after a row mutation; remote mutations affect the loaded page only.
     * @param {number} [change=0] The change in the remote row count.
     */
    #mutated(change = 0) {
        if (!this.node) {
            return;
        }

        if (!this.options.getResults) {
            this.#load();

            return;
        }

        // Remote mutations apply to the loaded page and invalidate any pending response.
        const version = this.#cancelRequest();

        if (!this.node || version !== this.#requestVersion) {
            return;
        }

        this.#total = Math.max(0, this.#total + change);
        this.#filtered = Math.max(0, this.#filtered + change);
        this.#refreshResults();

        if (!this.#data.length && this.#offset) {
            this.#offset = Math.max(0, this.#offset - this.#limit);
            this.#load();

            return;
        }

        this.loading({ show: false });

        if (this.node) {
            this.#renderResults();
        }
    }

    /**
     * Publishes effective selection changes with independent ID arrays.
     */
    #notifySelectionChange() {
        if (!this.node || !this.options.selection) {
            return;
        }

        const selectedIds = [...this.#selectedIds];
        const addedIds = selectedIds.filter((id) => !this.#notifiedSelectedIds.has(id));
        const removedIds = [...this.#notifiedSelectedIds].filter((id) => !this.#selectedIds.has(id));

        if (!addedIds.length && !removedIds.length) {
            return;
        }

        this.#notifiedSelectedIds = new Set(selectedIds);
        $.triggerEvent(this.node, 'selectionchange.ui.table', { detail: { selectedIds, addedIds, removedIds } });
    }

    /**
     * Publishes changed view configuration independently of request completion.
     */
    #notifyStateChange() {
        if (!this.node) {
            return;
        }

        const state = this.getState();
        const key = JSON.stringify(state);

        if (key === this.#stateKey) {
            return;
        }

        this.#stateKey = key;
        $.triggerEvent(this.node, 'statechange.ui.table', { detail: { state } });
    }

    /**
     * Refreshes the results.
     */
    #refreshResults() {
        this.#page = this.options.paging ? 1 + this.#offset / this.#limit : 1;
        this.#totalPages = this.options.paging ? Math.max(1, Math.ceil(this.#filtered / this.#limit)) : 1;

        if (this.options.getResults) {
            this.#rowIndexes = this.#data.map((_, index) => index);
        }

        this.#results = this.#rowIndexes.map((index) => this.#data[index]);
    }

    /**
     * Renders the Table.
     */
    #render() {
        this.#original = $.createFragment();
        $.append(this.#original, $.contents(this.node));

        this.#container = $.create('div', {
            class: this.constructor.classes.container,
        });

        this.#loader = $.create('div', {
            class: this.constructor.classes.loader,
            attributes: {
                'role': 'progressbar',
                'aria-label': this.options.lang.loading,
            },
        });

        const loaderIcon = $.create('span', {
            class: this.constructor.classes.loaderIcon,
        });
        $.append(this.#loader, loaderIcon);

        $.addClass(this.node, this.constructor.classes.table);

        const caption = $.findOne('caption', this.#original);

        if (caption) {
            $.append(this.node, $.clone(caption));
        }

        const thead = $.create('thead');
        $.append(this.node, thead);

        this.#theadRow = $.create('tr');
        $.append(thead, this.#theadRow);

        this.#tbody = $.create('tbody');
        $.append(this.node, this.#tbody);

        const tfoot = $.findOne('tfoot', this.#original);

        if (tfoot) {
            this.#tfoot = $.clone(tfoot)[0];
            this.#footerCells = getFooterCells(this.#tfoot);
            $.append(this.node, this.#tfoot);
        }

        if (this.options.selection) {
            this.#selectionHeading = $.create('th', { class: this.constructor.classes.selectionCell });

            if (this.options.selection === 'multiple') {
                $.append(this.#selectionHeading, $.create('input', {
                    class: this.constructor.classes.selectionInput,
                    attributes: {
                        'type': 'checkbox',
                        'aria-label': this.options.lang.selection.page,
                        'aria-controls': $.getAttribute(this.node, 'id'),
                    },
                    dataset: { uiSelectPage: '' },
                }));
            }

            $.prepend(this.#theadRow, this.#selectionHeading);

            for (const row of $.find('tr', this.#tfoot ?? [])) {
                $.prepend(row, $.create('td', { class: this.constructor.classes.selectionCell }));
            }
        }

        if (this.options.responsive) {
            this.#responsiveHeading = $.create('th', {
                class: this.constructor.classes.detailCell,
                attributes: { 'aria-label': this.options.lang.responsive.details, 'hidden': true },
            });
            $.append(this.#theadRow, this.#responsiveHeading);

            for (const row of $.find('tr', this.#tfoot ?? [])) {
                const cell = $.create('td', { attributes: { hidden: true } });

                if (this.options.selection) {
                    $.insertAfter(cell, $.children(row)[0]);
                } else {
                    $.prepend(row, cell);
                }

                this.#responsiveFooterCells.push(cell);
            }
        }

        $.hide(this.#loader);
        $.after(this.node, this.#container);
        $.append(this.#container, this.#loader);

        if (this.options.layout.top) {
            this.#renderLayoutRow(this.options.layout.top, this.constructor.classes.topRow);

            if (!this.node) {
                return;
            }
        }

        this.#tableContainer = $.create('div', {
            class: this.constructor.classes.tableContainer,
        });

        $.append(this.#tableContainer, this.node);
        $.append(this.#container, this.#tableContainer);

        if (this.options.layout.bottom) {
            this.#renderLayoutRow(this.options.layout.bottom, this.constructor.classes.bottomRow);

            if (!this.node) {
                return;
            }
        }

        if (this.#infoContainer) {
            const descriptions = [
                this.#originalDescription,
                $.getProperty(this.#infoContainer, 'id'),
            ];

            $.setAttribute(this.node, {
                'aria-describedby': descriptions.filter(Boolean).join(' '),
            });
        }
    }

    /**
     * Renders the table buttons.
     * @param {HTMLElement} container The container to render in.
     */
    #renderButtons(container) {
        const btnGroup = $.create('div', {
            class: this.constructor.classes.buttonGroup,
        });

        for (const button of this.options.buttons) {
            const btn = $.create('button', {
                class: this.constructor.classes.button,
                text: !button.text && button.type in this.options.lang.buttons ?
                    this.options.lang.buttons[button.type] :
                    button.text,
                attributes: {
                    'type': 'button',
                    'aria-controls': $.getAttribute(this.node, 'id'),
                },
            });

            $.addEvent(btn, 'click.ui.table', (event) => {
                event.preventDefault();

                if (button.callback) {
                    button.callback.call(this);
                } else if (Object.hasOwn(this.constructor.buttons, button.type)) {
                    if (button.type === 'columns') {
                        // The registered handler owns clicks; Dropdown handles the other keyboard controls.
                        event.stopPropagation();
                    }

                    this.constructor.buttons[button.type].call(this, button, btn);
                }
            });

            if (button.type === 'columns' && !button.callback) {
                this.#renderColumnPicker(btnGroup, btn, button);
            } else {
                $.append(btnGroup, btn);
            }
        }

        $.append(container, btnGroup);
    }

    /**
     * Renders a persistent column picker beside its trigger.
     * @param {HTMLElement} container The button group.
     * @param {HTMLButtonElement} button The trigger.
     * @param {TableButton} options The picker options.
     */
    #renderColumnPicker(container, button, options) {
        const columns = options.columns ?? this.#columns.map((_, index) => index);

        if (!Array.isArray(columns)) {
            throw new TypeError('Picker columns must be an array.');
        }

        for (const index of columns) {
            validateColumnIndex(index, this.#columns.length);
        }

        if (new Set(columns).size !== columns.length) {
            throw new RangeError('Picker columns must not contain duplicate indexes.');
        }

        const id = generateId('table-columns');
        const triggerId = generateId('table-columns-button');

        const group = $.create('div', { class: this.constructor.classes.columnPickerGroup });
        const menu = $.create('div', {
            class: this.constructor.classes.columnPicker,
            attributes: {
                id,
                'role': 'group',
                'aria-labelledby': triggerId,
            },
        });

        $.addClass(button, this.constructor.classes.columnPickerButton);
        $.setAttribute(button, {
            'id': triggerId,
            'aria-controls': id,
            'aria-expanded': false,
        });
        $.setDataset(button, { uiToggle: 'dropdown' });

        $.append(group, [button, menu]);
        $.append(container, group);

        const inputs = new Map();

        for (const index of columns) {
            const heading = $.create('div');
            $.setHtml(heading, $.sanitize(String(this.#headings[index].text)));
            const text = $.getText(heading).trim() || this.options.lang.column.replace('{column}', index + 1);

            const label = $.create('label', { class: this.constructor.classes.columnPickerLabel });
            const input = $.create('input', {
                class: this.constructor.classes.columnPickerInput,
                attributes: { 'type': 'checkbox', 'aria-controls': $.getAttribute(this.node, 'id') },
            });
            const span = $.create('span', { class: this.constructor.classes.columnPickerText, text });

            $.setProperty(input, 'checked', Boolean(this.#columns[index].visible));

            $.addEvent(input, 'change.ui.table', () => {
                this[$.getProperty(input, 'checked') ? 'showColumn' : 'hideColumn'](index);
            });

            $.append(label, [input, span]);
            $.append(menu, label);
            inputs.set(index, input);
        }

        const dropdown = Dropdown.init(button, { autoClose: 'outside' });
        this.#columnPickers.push({ dropdown, inputs });

        $.addEvent(button, 'keydown.ui.table', (event) => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.code)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            dropdown.show();

            if (this.node && $.hasClass(menu, 'show')) {
                $.focus(inputs.values().next().value);
            }
        });

        // Dropdown handles Escape during document capture; return focus after it starts closing.
        this.listen(document, 'keydown.ui.table', (event) => {
            if (event.code === 'Escape' && $.hasDescendent(menu, event.target)) {
                $.focus(button);
            }
        }, { capture: true });
    }

    /**
     * Renders the table headings.
     */
    #renderHeadings() {
        const version = this.#drawVersion;
        const children = $.children(this.#theadRow, '[data-ui-index]');

        const headings = {};

        for (const child of children) {
            const index = $.getDataset(child, 'uiIndex');

            if (!this.#columns[index].visible) {
                $.detach(child);
            } else {
                headings[index] = child;
            }
        }

        let lastCell = this.#responsiveHeading ?? this.#selectionHeading;

        for (const [index, heading] of this.#headings.entries()) {
            if (!this.#columns[index].visible) {
                continue;
            }

            let cell;

            if (index in headings) {
                cell = headings[index];
            } else {
                const html = this.options.sanitize(String(heading.text));

                if (!this.node || version !== this.#drawVersion) {
                    return;
                }

                cell = $.create('th', {
                    class: this.constructor.classes.tableHeading,
                    html,
                    dataset: {
                        uiIndex: index,
                    },
                });

                if (heading.class) {
                    $.addClass(cell, heading.class);
                }

                if (this.options.ordering && this.#columns[index].orderable) {
                    $.addClass(cell, this.constructor.classes.tableSort);
                    $.setAttribute(cell, {
                        'tabindex': 0,
                        'aria-controls': $.getAttribute(this.node, 'id'),
                    });
                }

                if (!this.node) {
                    return;
                }

                if (!lastCell) {
                    $.prepend(this.#theadRow, cell);
                } else {
                    $.insertAfter(cell, lastCell);
                }
            }

            lastCell = cell;

            if (!this.options.ordering || !this.#columns[index].orderable) {
                continue;
            }

            const dir = this.#order.find(([column]) => column === index)?.[1];

            switch (dir) {
                case 'asc':
                    $.addClass(cell, this.constructor.classes.tableSortAsc);
                    $.removeClass(cell, this.constructor.classes.tableSortDesc);
                    $.setAttribute(cell, { 'aria-sort': 'ascending' });
                    break;
                case 'desc':
                    $.addClass(cell, this.constructor.classes.tableSortDesc);
                    $.removeClass(cell, this.constructor.classes.tableSortAsc);
                    $.setAttribute(cell, { 'aria-sort': 'descending' });
                    break;
                default:
                    $.removeClass(cell, [
                        this.constructor.classes.tableSortAsc,
                        this.constructor.classes.tableSortDesc,
                    ]);
                    $.removeAttribute(cell, 'aria-sort');
                    break;
            }

            const text = $.getText(cell);

            if (dir === 'asc' || (!dir && this.#columns[index].dir === 'desc')) {
                $.setAttribute(cell, { 'aria-label': `${text}${this.options.lang.aria.sortDescending}` });
            } else {
                $.setAttribute(cell, { 'aria-label': `${text}${this.options.lang.aria.sortAscending}` });
            }
        }
    }

    /**
     * Renders the table info.
     */
    #renderInfo() {
        const version = this.#drawVersion;
        $.empty(this.#infoContainer);

        const start = this.#results.length ? this.#offset + 1 : 0;
        const end = this.#offset + this.#results.length;
        let infoText = this.#filtered < this.#total ?
            this.options.lang.infoFiltered :
            this.options.lang.info;

        const replacements = {
            start,
            end,
            filtered: this.#filtered,
            total: this.#total,
        };

        for (const [key, value] of Object.entries(replacements)) {
            infoText = infoText.replace(`{${key}}`, value);
        }

        if (this.options.infoCallback) {
            infoText = this.options.infoCallback.call(this, start, end, this.#total, this.#filtered, infoText);
        }

        if (!this.node || version !== this.#drawVersion) {
            return;
        }

        const text = $.create('small', {
            text: infoText,
        });
        $.append(this.#infoContainer, text);
    }

    /**
     * Renders the table info container in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderInfoContainer(container) {
        if (!this.options.info) {
            return;
        }

        const id = generateId('table-info');

        this.#infoContainer = $.create('div', {
            class: this.constructor.classes.infoContainer,
            attributes: {
                id,
                'role': 'status',
                'aria-live': 'polite',
            },
        });

        $.append(container, this.#infoContainer);
    }

    /**
     * Renders a layout row in a container.
     * @param {Array} columns The columns to render.
     * @param {string} rowClass The row class.
     */
    #renderLayoutRow(columns, rowClass) {
        const row = $.create('div', {
            class: rowClass,
        });

        for (const elements of columns.split(',')) {
            const column = $.create('div', {
                class: this.constructor.classes.column,
            });

            for (const element of elements.split('|')) {
                if (!Object.hasOwn(this.constructor.layout, element)) {
                    continue;
                }

                const container = $.create('div', {
                    class: this.constructor.classes.columnContainer,
                });

                this.constructor.layout[element].call(this, container);

                if (!this.node) {
                    return;
                }

                $.append(column, container);
            }

            $.append(row, column);
        }

        $.append(this.#container, row);
    }

    /**
     * Renders the length select in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderLengthSelect(container) {
        if (!this.options.lengthChange || !this.options.paging) {
            return;
        }

        const lengthContainer = $.create('div', {
            class: this.constructor.classes.lengthContainer,
        });

        const label = $.create('label', {
            class: this.constructor.classes.lengthLabel,
        });
        $.append(lengthContainer, label);

        const labelText = $.create('small', {
            class: this.constructor.classes.lengthLabelText,
            text: this.options.lang.perPage,
        });
        $.append(label, labelText);

        const inputContainer = $.create('div', {
            class: this.constructor.classes.lengthInputContainer,
            style: {
                width: 'initial',
            },
        });
        $.append(label, inputContainer);

        this.#lengthSelect = $.create('select', {
            class: this.options.inputStyle === 'filled' ?
                this.constructor.classes.lengthInputFilled :
                this.constructor.classes.lengthInputOutline,
            attributes: {
                'aria-controls': $.getAttribute(this.node, 'id'),
            },
        });
        $.append(inputContainer, this.#lengthSelect);

        for (const length of this.options.lengths) {
            const option = $.create('option', {
                value: length,
                text: length,
            });

            $.append(this.#lengthSelect, option);
        }

        this.#syncLength();
        $.append(container, lengthContainer);
    }

    /**
     * Renders a pagination item.
     * @param {object} options Options for rendering the pagnination item.
     * @returns {HTMLElement} The pagnination item.
     */
    #renderPageItem(options) {
        const label = options.text ?
            `${options.text} ${this.options.lang.page}` :
            `${this.options.lang.page} ${options.page}`;

        const container = $.create('div', {
            class: this.constructor.classes.pageItem,
        });

        const link = $.create('button', {
            html: options.icon || options.text || options.page,
            class: this.constructor.classes.pageLink,
            attributes: {
                'type': 'button',
                'title': label,
                'aria-label': label,
                'aria-controls': $.getAttribute(this.node, 'id'),
            },
            dataset: {
                uiPage: options.page,
            },
        });
        $.append(container, link);

        return container;
    }

    /**
     * Renders the pagination.
     */
    #renderPagination() {
        const setDisabled = (container, disabled) => {
            const link = $.findOne(':scope > [data-ui-page]', container);
            $.setProperty(link, { disabled });

            if (disabled) {
                $.addClass(container, this.constructor.classes.pageDisabled);
                $.setAttribute(link, {
                    'aria-disabled': true,
                    'tabindex': -1,
                });
            } else {
                $.removeClass(container, this.constructor.classes.pageDisabled);
                $.removeAttribute(link, 'aria-disabled');
                $.removeAttribute(link, 'tabindex');
            }
        };

        const children = $.children(this.#pagination);

        let firstPage;
        let prevPage;
        let nextPage;
        let lastPage;

        if (children.length) {
            firstPage = children.shift();
            prevPage = children.shift();
            lastPage = children.pop();
            nextPage = children.pop();
        } else {
            firstPage = this.#renderPageItem({
                text: this.options.lang.paginate.first,
                icon: this.options.icons.first,
                page: 'first',
            });
            $.append(this.#pagination, firstPage);

            prevPage = this.#renderPageItem({
                text: this.options.lang.paginate.previous,
                icon: this.options.icons.previous,
                page: 'prev',
            });
            $.append(this.#pagination, prevPage);

            nextPage = this.#renderPageItem({
                text: this.options.lang.paginate.next,
                icon: this.options.icons.next,
                page: 'next',
            });
            $.append(this.#pagination, nextPage);

            lastPage = this.#renderPageItem({
                text: this.options.lang.paginate.last,
                icon: this.options.icons.last,
                page: 'last',
            });
            $.append(this.#pagination, lastPage);
        }

        setDisabled(firstPage, this.#page === 1);
        setDisabled(prevPage, this.#page === 1);
        setDisabled(nextPage, this.#page === this.#totalPages);
        setDisabled(lastPage, this.#page === this.#totalPages);

        let startPage = Math.max(this.#page - 5, 1);
        let endPage = Math.min(this.#page + 5, this.#totalPages);

        while (endPage - startPage > 4) {
            if (this.#page - startPage > endPage - this.#page) {
                startPage++;
            } else {
                endPage--;
            }
        }

        const pageLinks = {};

        for (const child of children) {
            const link = $.findOne(':scope > [data-ui-page]', child);
            const page = $.getDataset(link, 'uiPage');

            if (page < startPage || page > endPage) {
                $.detach(child);
            } else {
                pageLinks[page] = child;
            }
        }

        let lastLink = prevPage;

        for (let current = startPage; current <= endPage; current++) {
            let pageItem;

            if (current in pageLinks) {
                pageItem = pageLinks[current];
            } else {
                pageItem = this.#renderPageItem({
                    page: current,
                });
                $.insertAfter(pageItem, lastLink);
            }

            const pageButton = $.findOne('button', pageItem);

            if (current === this.#page) {
                $.setAttribute(pageButton, { 'aria-current': 'page' });
                $.addClass(pageItem, this.constructor.classes.pageActive);
            } else {
                $.removeAttribute(pageButton, 'aria-current');
                $.removeClass(pageItem, this.constructor.classes.pageActive);
            }

            lastLink = pageItem;
        }
    }

    /**
     * Renders the pagination container in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderPaginationContainer(container) {
        if (!this.options.paging) {
            return;
        }

        const paginationContainer = $.create('div', {
            class: this.constructor.classes.paginationContainer,
        });
        $.append(container, paginationContainer);

        this.#pagination = $.create('div', {
            class: this.constructor.classes.pagination,
        });
        $.append(paginationContainer, this.#pagination);
    }

    /**
     * Creates the disclosure control without changing data column indexes.
     * @param {object} entry The rendered data row.
     */
    #renderResponsiveControl(entry) {
        if (entry.button) {
            return;
        }

        entry.detailId = generateId('table-details');
        entry.button = $.create('button', {
            class: this.constructor.classes.detailButton,
            attributes: {
                'type': 'button',
                'title': this.options.lang.responsive.details,
                'aria-controls': entry.detailId,
                'aria-expanded': false,
            },
        });

        $.append(entry.button, $.create('span', {
            class: 'visually-hidden',
            text: this.options.lang.responsive.details,
        }));

        $.addEvent(entry.button, 'click.ui.table', () => {
            if (this.#data[entry.index] !== entry.data) {
                return;
            }

            if (this.#expandedRows.has(entry.key)) {
                this.#expandedRows.delete(entry.key);
            } else {
                this.#expandedRows.add(entry.key);
            }

            this.#renderResponsiveDetails(entry);
        });

        $.append(entry.control, entry.button);
    }

    /**
     * Renders display values for collapsed fields without invoking data-row callbacks.
     * @param {object} entry The rendered data row.
     */
    #renderResponsiveDetails(entry) {
        if (this.#data[entry.index] !== entry.data) {
            $.setProperty(entry.button, 'disabled', true);

            return;
        }

        const version = this.#drawVersion;
        const expanded = this.#expandedRows.has(entry.key);
        const label = this.options.lang.responsive[expanded ? 'hide' : 'show'];
        $.setAttribute(entry.button, {
            'aria-expanded': expanded,
            'aria-label': label.replace('{row}', String(this.options.rowId === null ? entry.pageIndex + 1 : entry.key)),
        });

        if (!expanded) {
            if (entry.detail) {
                $.remove(entry.detail);
                entry.detail = null;
            }

            return;
        }

        const columns = [];

        for (const index of this.#getVisibleColumns()) {
            if (!this.#collapsedColumns.has(index)) {
                continue;
            }

            const heading = $.create('div');
            $.setHtml(heading, $.sanitize(String(this.#headings[index].text)));
            const text = $.getText(heading).trim() || this.options.lang.column.replace('{column}', index + 1);
            const value = this.#getValue(entry.index, index, 'display');

            if (!this.node || version !== this.#drawVersion) {
                return;
            }

            const html = this.options.sanitize(String(value ?? ''));

            if (!this.node || version !== this.#drawVersion) {
                return;
            }

            columns.push({ column: index, data: this.#columns[index].data, title: text, html });
        }

        const cell = $.create('td', { attributes: { colspan: this.#getRenderedColumnCount() } });

        if (this.options.renderDetails) {
            const result = this.options.renderDetails.call(this, entry.data, { rowIndex: entry.index, columns });

            if (!this.node || version !== this.#drawVersion) {
                return;
            }

            if (typeof result !== 'string') {
                throw new TypeError('Details renderer must return an HTML string.');
            }

            const html = this.options.sanitize(result);

            if (!this.node || version !== this.#drawVersion) {
                return;
            }

            $.setHtml(cell, html);
        } else {
            const list = $.create('dl', { class: this.constructor.classes.detailList });

            for (const { title, html } of columns) {
                $.append(list, [$.create('dt', { text: title }), $.create('dd', { html })]);
            }

            $.append(cell, list);
        }

        if (!entry.detail) {
            entry.detail = $.create('tr', {
                class: this.constructor.classes.detailRow,
                attributes: { id: entry.detailId },
            });
            $.insertAfter(entry.detail, entry.row);
        }

        $.empty(entry.detail);
        $.append(entry.detail, cell);
        $.setProperty(entry.detail, 'hidden', false);
    }

    /**
     * Renders the table results.
     */
    #renderResults() {
        if (!this.node) {
            return;
        }

        // User callbacks may dispose the table or draw again. Stop an older draw after each callback.
        const version = ++this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;
        this.#syncColumnPickers();
        this.#syncSelection();
        this.#notifySelectionChange();

        if (!active()) {
            return;
        }

        this.#notifyStateChange();

        if (!active()) {
            return;
        }

        $.triggerEvent(this.node, 'preDraw.ui.table');

        if (!active()) {
            return;
        }

        const proceed = this.options.preDrawCallback?.call(this);

        if (!active() || proceed === false) {
            return;
        }

        $.empty(this.#tbody);
        this.#emptyCell = null;
        this.#responsiveRows = [];
        this.#collapsedColumns.clear();

        if (this.options.rowId === null) {
            this.#expandedRows.clear();
        } else {
            const ids = new Set(this.#rowIndexes.map((index) => this.#rowIds[index]));
            this.#expandedRows = new Set([...this.#expandedRows].filter((id) => ids.has(id)));
        }

        this.#renderHeadings();
        this.#syncResponsiveColumns();
        this.#syncFooter();

        if (!active()) {
            return;
        }

        const end = this.#offset + this.#results.length;
        this.options.headerCallback?.call(this, this.#theadRow, this.#data, this.#offset, end, [...this.#rowIndexes]);

        if (!active()) {
            return;
        }

        if (this.#pagination) {
            this.#renderPagination();
        }

        if (this.#infoContainer) {
            this.#renderInfo();
        }

        if (!active()) {
            return;
        }

        if (!this.#results.length) {
            const row = $.create('tr');
            this.#emptyCell = $.create('td', {
                class: this.constructor.classes.emptyCell,
                text: this.#term || this.#filters.length || this.#rowFilter ? this.options.lang.noResults : this.options.lang.noData,
                attributes: {
                    colspan: this.#getRenderedColumnCount(),
                },
            });
            $.append(row, this.#emptyCell);
            $.append(this.#tbody, row);
        } else {
            for (const [index, result] of this.#results.entries()) {
                const row = this.#renderRow(result, index);

                if (!active()) {
                    return;
                }

                this.options.rowCallback?.call(this, row, result, index, this.#offset + index, this.#rowIndexes[index]);

                if (!active()) {
                    return;
                }

                $.append(this.#tbody, row);
                this.options.createdRow?.call(this, row, result, index);

                if (!active()) {
                    return;
                }
            }
        }

        this.#syncSelection();
        this.options.drawCallback?.call(this);

        if (!active()) {
            return;
        }

        if (this.#tfoot) {
            this.options.footerCallback?.call(this, this.#tfoot, this.#data, this.#offset, end, [...this.#rowIndexes]);
        }

        if (active()) {
            this.#updateResponsive();
        }

        if (active()) {
            $.triggerEvent(this.node, 'draw.ui.table');
        }
    }

    /**
     * Renders a result row.
     * @param {Array|object} data The row data.
     * @param {number} rowIndex The row index.
     * @returns {HTMLElement} The table row.
     */
    #renderRow(data, rowIndex) {
        const row = $.create('tr');
        const version = this.#drawVersion;

        if (this.options.selection) {
            const index = this.#rowIndexes[rowIndex];
            const id = this.#rowIds[index];
            const cell = $.create('td', { class: this.constructor.classes.selectionCell });
            const input = $.create('input', {
                class: this.constructor.classes.selectionInput,
                attributes: {
                    'type': this.options.selection === 'single' ? 'radio' : 'checkbox',
                    'name': this.#selectionName,
                    'aria-label': this.options.lang.selection.row.replace('{id}', String(id)),
                },
                dataset: { uiSelectRow: index },
            });
            this.#selectionInputs.set(input, id);
            $.setProperty(input, 'checked', this.#selectedIds.has(id));
            $.append(cell, input);
            $.append(row, cell);

            if (this.#selectedIds.has(id)) {
                $.addClass(row, this.constructor.classes.selectedRow);
            }
        }

        let responsive;

        if (this.options.responsive) {
            const index = this.#rowIndexes[rowIndex];
            const control = $.create('td', {
                class: this.constructor.classes.detailCell,
                attributes: { hidden: true },
            });

            $.append(row, control);

            responsive = {
                row,
                control,
                data,
                index,
                pageIndex: rowIndex,
                key: this.options.rowId === null ? index : this.#rowIds[index],
                cells: new Map(),
                button: null,
                detail: null,
            };
            this.#responsiveRows.push(responsive);
        }

        for (const [index, column] of this.#columns.entries()) {
            if (!column.visible) {
                continue;
            }

            const value = $._getDot(data, String(column.data));
            const formatted = this.#getValue(this.#rowIndexes[rowIndex], index, 'display');

            if (!this.node || version !== this.#drawVersion) {
                return row;
            }

            const html = this.options.sanitize(String(formatted ?? ''));

            if (!this.node || version !== this.#drawVersion) {
                return row;
            }

            const cell = $.create('td', {
                html,
                class: column.class || '',
            });
            responsive?.cells.set(index, cell);
            column.createdCell?.call(this, cell, value, data, rowIndex, index);

            if (!this.node || version !== this.#drawVersion) {
                return row;
            }

            $.append(row, cell);
        }

        return row;
    }

    /**
     * Renders the search in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderSearch(container) {
        if (!this.options.searching) {
            return;
        }

        const searchContainer = $.create('div', {
            class: this.constructor.classes.searchContainer,
        });

        const inputContainer = $.create('div', {
            class: this.constructor.classes.searchInputContainer,
            style: {
                width: '200px',
            },
        });
        $.append(searchContainer, inputContainer);

        this.#searchInput = $.create('input', {
            class: this.options.inputStyle === 'filled' ?
                this.constructor.classes.searchInputFilled :
                this.constructor.classes.searchInputOutline,
            attributes: {
                'type': 'search',
                'placeholder': this.options.lang.search,
                'aria-label': this.options.lang.search,
                'aria-controls': $.getAttribute(this.node, 'id'),
            },
        });
        $.append(inputContainer, this.#searchInput);

        $.append(container, searchContainer);
    }

    /**
     * Renders a selected-count status and clear button.
     * @param {HTMLElement} container The layout container.
     */
    #renderSelection(container) {
        if (!this.options.selection) {
            return;
        }

        $.addClass(container, this.constructor.classes.selectionContainer);
        this.#selectionCount = $.create('small', {
            attributes: { 'role': 'status', 'aria-live': 'polite' },
        });
        this.#selectionClear = $.create('button', {
            class: this.constructor.classes.button,
            text: this.options.lang.selection.clear,
            attributes: { type: 'button' },
        });
        $.addEvent(this.#selectionClear, 'click.ui.table', () => this.setSelectedIds([]));
        $.append(container, [this.#selectionCount, this.#selectionClear]);
        this.#syncSelection();
    }

    /**
     * Coalesces container and font changes without drawing or loading data.
     */
    #scheduleResponsive() {
        if (!this.node || !this.options.responsive || this.#responsiveFrame !== null) {
            return;
        }

        this.#responsiveFrame = requestAnimationFrame(() => {
            this.#responsiveFrame = null;
            this.#updateResponsive();
        });
    }

    /**
     * Changes selection using the shared ordered data scopes.
     * @param {'page'|'filtered'|'all'} scope The row scope.
     * @param {boolean} selected Whether to select or deselect the scoped rows.
     */
    #selectScope(scope, selected) {
        if (!this.node) {
            return;
        }

        if (!this.options.selection) {
            throw new TypeError('Row selection is disabled.');
        }

        const version = this.#drawVersion;
        const indexes = this.#getDataIndexes(scope);

        if (!this.node || version !== this.#drawVersion) {
            return;
        }

        const ids = new Set(this.#selectedIds);

        for (const index of indexes) {
            if (selected) {
                ids.add(this.#rowIds[index]);
            } else {
                ids.delete(this.#rowIds[index]);
            }
        }

        this.setSelectedIds([...ids]);
    }

    /**
     * Installs validated data and reconciles local selection before drawing.
     * @param {TableRow[]} data The replacement loaded data.
     * @param {object} [options] Identity validation options.
     * @param {boolean} [options.preserveIds=false] Whether row identities must stay unchanged.
     * @returns {boolean} Whether the data was installed.
     */
    #setData(data, { preserveIds = false } = {}) {
        const identities = this.#getRowIdentities(data);

        if (!identities) {
            return false;
        }

        const ids = [...identities.keys()];

        if (preserveIds && ids.some((id, index) => id !== this.#rowIds[index])) {
            throw new TypeError('Replacing row values must preserve row IDs.');
        }

        this.#drawVersion++;
        this.#data = data;
        this.#rowIdIndexes = identities;
        this.#rowIds = ids;

        if (!this.options.getResults) {
            this.#selectedIds = new Set([...this.#selectedIds].filter((id) => identities.has(id)));
        }

        return true;
    }

    /**
     * Validates column writes together before mutating any source rows.
     * @param {number[]} indexes The loaded row indexes.
     * @param {string} key The data path.
     * @param {Array<*>} values The replacement values.
     */
    #setValues(indexes, key, values) {
        if (this.options.rowId !== null) {
            const data = [...this.#data];
            const metadata = indexes.map((index) => this.#domValues.get(data[index]));

            for (const [offset, index] of indexes.entries()) {
                data[index] = copyRowValue(data[index], key, values[offset]);
            }

            if (!this.#setData(data, { preserveIds: true })) {
                return;
            }

            for (const [offset, index] of indexes.entries()) {
                if (metadata[offset]) {
                    const copy = new Map(metadata[offset]);
                    copy.delete(key);
                    this.#domValues.set(data[index], copy);
                }
            }
        } else {
            for (const [offset, index] of indexes.entries()) {
                $._setDot(this.#data[index], key, values[offset]);
                this.#domValues.get(this.#data[index])?.delete(key);
            }
        }

        this.#mutated();
    }

    /**
     * Sorts local indexes, stopping if a callback interrupts the operation.
     * @param {number[]} indexes The indexes to sort in place.
     * @returns {number[]|null} The ordered indexes, or null if interrupted.
     */
    #sortIndexes(indexes) {
        const version = this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;
        const order = this.options.ordering ? this.#getOrder() : [];

        // Resolve keys once per row so sorting does not repeatedly invoke renderers.
        const values = new Map();

        for (const rowIndex of indexes) {
            const row = [];

            for (const [index] of order) {
                const column = this.#columns[index];
                const raw = this.#getValue(rowIndex, index, 'sort');

                if (!active()) {
                    return null;
                }

                row.push({ raw, value: normalizeSortValue(raw, column.type) });
            }

            values.set(rowIndex, row);
        }

        indexes.sort((a, b) => {
            if (!active()) {
                return 0;
            }

            for (const [key, [index, direction]] of order.entries()) {
                const column = this.#columns[index];
                const aValue = values.get(a)[key];
                const bValue = values.get(b)[key];

                if (column.type !== 'auto' && (aValue.value === null || bValue.value === null)) {
                    if (aValue.value === bValue.value) {
                        continue;
                    }

                    return aValue.value === null ? 1 : -1;
                }

                let difference;

                if (column.compare) {
                    difference = column.compare.call(this, aValue.raw, bValue.raw, { column: index });

                    if (!active()) {
                        return 0;
                    }

                    if (!Number.isFinite(difference)) {
                        throw new TypeError('Column compare must return a finite number.');
                    }
                } else if (column.type === 'number' || column.type === 'date' ||
                    (column.type === 'auto' && $._isNumeric(aValue.value) && $._isNumeric(bValue.value))) {
                    difference = Number(aValue.value) - Number(bValue.value);
                } else {
                    const aText = String(aValue.value ?? '').toLocaleLowerCase();
                    const bText = String(bValue.value ?? '').toLocaleLowerCase();
                    difference = aText.localeCompare(bText);
                }

                if (difference) {
                    return direction === 'desc' ? -difference : difference;
                }
            }

            // Equal values retain their original data order across sorting and filtering.
            return a - b;
        });

        if (!active()) {
            return null;
        }

        return indexes;
    }

    /**
     * Synchronizes picker checkboxes without replacing focused controls.
     */
    #syncColumnPickers() {
        for (const { inputs } of this.#columnPickers) {
            for (const [index, input] of inputs) {
                $.setProperty(input, 'checked', Boolean(this.#columns[index].visible));
            }
        }
    }

    /**
     * Aligns footer cells with visible data columns while retaining their source spans.
     */
    #syncFooter() {
        for (const { cell, columns, hidden } of this.#footerCells) {
            const count = columns.filter((index) => this.#columns[index]?.visible && !this.#collapsedColumns.has(index)).length;
            $.setProperty(cell, 'hidden', hidden || !count);
            $.setProperty(cell, 'colSpan', Math.max(1, count));
        }
    }

    /**
     * Selects the current length, including a programmatically requested length.
     */
    #syncLength() {
        if (!this.#lengthSelect) {
            return;
        }

        const options = $.children(this.#lengthSelect, 'option');
        const hasLength = options.some((option) => Number($.getValue(option)) === this.#limit);

        if (!hasLength) {
            const option = $.create('option', {
                value: this.#limit,
                text: this.#limit,
            });
            $.append(this.#lengthSelect, option);
        }

        $.setValue(this.#lengthSelect, this.#limit);
    }

    /**
     * Applies temporary collapse separately from configured column visibility.
     */
    #syncResponsiveColumns() {
        if (!this.options.responsive) {
            return;
        }

        const collapsed = this.#collapsedColumns;

        for (const cell of $.children(this.#theadRow, '[data-ui-index]')) {
            $.setProperty(cell, 'hidden', collapsed.has(Number($.getDataset(cell, 'uiIndex'))));
        }

        for (const entry of this.#responsiveRows) {
            for (const [index, cell] of entry.cells) {
                $.setProperty(cell, 'hidden', collapsed.has(index));
            }

            $.setProperty(entry.control, 'hidden', !collapsed.size);
        }

        $.setProperty(this.#responsiveHeading, 'hidden', !collapsed.size);

        for (const cell of this.#responsiveFooterCells) {
            $.setProperty(cell, 'hidden', !collapsed.size);
        }

        if (this.#emptyCell) {
            $.setProperty(this.#emptyCell, 'colSpan', this.#getRenderedColumnCount());
        }

        this.#syncFooter();
    }

    /**
     * Synchronizes mounted selection controls without rebuilding rows or moving focus.
     */
    #syncSelection() {
        if (!this.node || !this.options.selection) {
            return;
        }

        for (const input of $.find('[data-ui-select-row]', this.#tbody ?? [])) {
            const id = this.#selectionInputs.get(input);
            const selected = this.#selectedIds.has(id);
            $.setProperty(input, 'checked', selected);
            $.setProperty(input, 'disabled', !this.#rowIdIndexes.has(id));
            $[selected ? 'addClass' : 'removeClass']($.closest(input, 'tr')[0], this.constructor.classes.selectedRow);
        }

        const header = $.findOne('[data-ui-select-page]', this.#selectionHeading ?? []);

        if (header) {
            const count = this.#rowIndexes.filter((index) => this.#selectedIds.has(this.#rowIds[index])).length;
            $.setProperty(header, 'checked', count > 0 && count === this.#rowIndexes.length);
            $.setProperty(header, 'indeterminate', count > 0 && count < this.#rowIndexes.length);
            $.setProperty(header, 'disabled', !this.#rowIndexes.length);
        }

        if (this.#selectionCount) {
            const text = this.options.lang.selection.count.replace('{count}', this.#selectedIds.size);

            if ($.getText(this.#selectionCount) !== text) {
                $.setText(this.#selectionCount, text);
            }

            $.setProperty(this.#selectionClear, 'disabled', !this.#selectedIds.size);
        }
    }

    /**
     * Recomputes local matching, stable ordering, counts, and the current page.
     */
    #updateLocal() {
        const version = this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;
        const term = this.#term.toLocaleLowerCase();
        let indexes = this.#data.map((_, index) => index);

        if (term) {
            const matches = [];

            for (const rowIndex of indexes) {
                for (const [index, column] of this.#columns.entries()) {
                    if (!column.searchable) {
                        continue;
                    }

                    const value = this.#getValue(rowIndex, index, 'filter');

                    if (!active()) {
                        return;
                    }

                    if (String(value ?? '').toLocaleLowerCase().includes(term)) {
                        matches.push(rowIndex);
                        break;
                    }
                }
            }

            indexes = matches;
        }

        for (const filter of this.#filters) {
            const matches = [];
            const column = this.#columns[filter.column];

            for (const rowIndex of indexes) {
                const value = this.#getValue(rowIndex, filter.column, 'filter');

                if (!active()) {
                    return;
                }

                if (matchesFilter(value, filter, column.type)) {
                    matches.push(rowIndex);
                }
            }

            indexes = matches;
        }

        if (this.#rowFilter) {
            const matches = [];

            for (const rowIndex of indexes) {
                const match = this.#rowFilter.call(this, this.#data[rowIndex]);

                if (!active()) {
                    return;
                }

                if (typeof match !== 'boolean') {
                    throw new TypeError('Row filters must return a boolean.');
                }

                if (match) {
                    matches.push(rowIndex);
                }
            }

            indexes = matches;
        }

        indexes = this.#sortIndexes(indexes);

        if (!indexes || !active()) {
            return;
        }

        this.#filteredIndexes = indexes;
        this.#total = this.#data.length;
        this.#filtered = indexes.length;

        if (this.options.paging) {
            const lastOffset = Math.max(0, (Math.ceil(indexes.length / this.#limit) - 1) * this.#limit);
            this.#offset = Math.min(this.#offset, lastOffset);
            indexes = indexes.slice(this.#offset, this.#offset + this.#limit);
        } else {
            this.#offset = 0;
        }

        this.#rowIndexes = indexes;
        this.#refreshResults();
    }

    /**
     * Measures visible columns and reconciles responsive details without a data redraw.
     */
    #updateResponsive() {
        if (!this.node || !this.options.responsive || !this.#tableContainer.clientWidth) {
            return;
        }

        const version = this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;

        const width = this.#tableContainer.clientWidth;
        const previous = this.#collapsedColumns;

        const focused = document.activeElement;
        const focusedEntry = this.#responsiveRows.find((entry) => $.isSame(entry.button, focused) ||
            (entry.detail && $.hasDescendent(entry.detail, focused)));

        const visible = this.#getVisibleColumns();
        const candidates = visible.filter((index) => this.#columns[index].responsivePriority !== null)
            .sort((a, b) => this.#columns[b].responsivePriority - this.#columns[a].responsivePriority || b - a);

        const releases = [];

        try {
            for (const [property, value] of [['width', 'max-content'], ['max-width', 'none'], ['table-layout', 'auto']]) {
                releases.push($.setStyleLock(this.node, property, value, { important: true }));
            }

            // Measure the existing cells synchronously; details must not influence column widths.
            for (const entry of this.#responsiveRows) {
                if (entry.detail) {
                    $.setProperty(entry.detail, 'hidden', true);
                }
            }

            this.#collapsedColumns = new Set();
            this.#syncResponsiveColumns();

            for (const index of candidates) {
                if (!active()) {
                    return;
                }

                if (visible.length - this.#collapsedColumns.size <= 1 || this.node.getBoundingClientRect().width <= width + 1) {
                    break;
                }

                this.#collapsedColumns.add(index);

                for (const entry of this.#responsiveRows) {
                    this.#renderResponsiveControl(entry);
                }

                this.#syncResponsiveColumns();
            }
        } finally {
            for (const release of releases) {
                release();
            }
        }

        const changed = previous.size !== this.#collapsedColumns.size ||
            [...previous].some((index) => !this.#collapsedColumns.has(index));

        if (!this.#collapsedColumns.size) {
            this.#expandedRows.clear();
        }

        for (const entry of this.#responsiveRows) {
            if (!this.#collapsedColumns.size) {
                if (entry === focusedEntry) {
                    const tabIndex = $.getAttribute(entry.row, 'tabindex');

                    if (tabIndex === null) {
                        $.setAttribute(entry.row, { tabindex: -1 });
                    }

                    $.focus(entry.row);

                    if (tabIndex === null && $.getAttribute(entry.row, 'tabindex') === '-1') {
                        $.removeAttribute(entry.row, 'tabindex');
                    }

                    if (!active()) {
                        return;
                    }
                }

                $.remove(entry.button);
                $.remove(entry.detail);
                entry.button = null;
                entry.detail = null;
            } else if (changed || !entry.detail) {
                this.#renderResponsiveDetails(entry);
            } else {
                $.setProperty(entry.detail, 'hidden', false);
            }

            if (!active()) {
                return;
            }

            if (entry === focusedEntry && this.#collapsedColumns.size && !$.isSame(focused, document.activeElement)) {
                $.focus(focused.isConnected ? focused : entry.button);

                if (!active()) {
                    return;
                }
            }
        }
    }
}
