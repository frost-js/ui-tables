import $ from '@fr0st/query';
import { BaseComponent, generateId } from '@fr0st/ui';
import { csv, excel, print } from './buttons.js';
import {
    buildTable, getDomData, getDomHeadings, normalizeColumns, normalizeOrder,
    normalizePageLength, normalizeSortValue, validateColumnIndex, validateRows,
} from './helpers.js';

/** @typedef {Array<*>|Record<string, *>} TableRow */
/** @typedef {[number, 'asc'|'desc']} TableOrder */
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
 * @property {boolean} [searchable=true] Whether local searches include the column.
 * @property {boolean} [visible=true] Whether the column is displayed.
 * @property {function(*): *} [format] Formats a cell value as HTML.
 * @property {function(*, TableValueContext): *} [render] Resolves a value for each operation; cannot accompany format.
 * @property {'auto'|'string'|'number'|'date'} [type='auto'] The local sort value type.
 * @property {function(*, *, {column: number}): number} [compare] Compares resolved sort values in ascending order.
 * @property {function(HTMLTableCellElement, *, TableRow, number, number): void} [createdCell] Receives a created cell.
 */
/**
 * @typedef {object} TableButton
 * @property {string} [type] The registered button type.
 * @property {string} [text] The button label.
 * @property {string} [title] The export title, defaulting to the document title.
 * @property {number[]} [columns] The columns to export; defaults to visible columns.
 * @property {boolean} [escapeFormulae=true] Prefixes formula-like CSV strings with an apostrophe.
 * @property {function(this: Table): void} [callback] Runs with the table as its receiver.
 */
/**
 * @typedef {object} TableRequest
 * @property {string} [term] The search term, omitted when empty.
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
 * @property {TableColumn[]|null} [columns=null] The column definitions.
 * @property {function(string): string} [sanitize] Sanitizes HTML cells and headings; defaults to query sanitization.
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
        csv(options) {
            const data = this.#getExportData(options);

            if (data) {
                csv(options, data);
            }
        },
        excel(options) {
            const data = this.#getExportData(options);

            if (data) {
                excel(options, data);
            }
        },
        print(options) {
            const data = this.#getExportData(options);

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
        bottomRow: 'd-md-flex justify-content-between',
        button: 'btn btn-table',
        buttonGroup: 'btn-group btn-group-sm mt-1',
        column: 'd-md-flex',
        columnContainer: 'text-center px-2 mb-1',
        container: 'position-relative mb-2',
        emptyCell: 'text-center py-3',
        infoContainer: 'text-center text-md-start mb-2 mb-md-0 w-100',
        lengthContainer: 'd-flex justify-content-center justify-content-md-start w-100 mb-1',
        lengthInputContainer: 'form-input d-inline-block',
        lengthInputFilled: 'input-filled input-sm',
        lengthInputOutline: 'input-outline input-sm',
        lengthLabel: 'mb-1 mb-md-0',
        lengthLabelText: 'me-2',
        loader: 'position-absolute top-50 start-50 translate-middle z-1',
        loaderIcon: 'spinner-border text-primary',
        pageActive: 'active',
        pageDisabled: 'disabled',
        pageItem: 'page-item',
        pageLink: 'page-link ripple',
        pagination: 'pagination pagination-sm mx-auto me-md-0',
        paginationContainer: 'd-flex w-100',
        searchContainer: 'w-100 mb-1',
        searchInputContainer: 'form-input mx-auto me-md-0',
        searchInputFilled: 'input-filled input-sm',
        searchInputOutline: 'input-outline input-sm',
        table: 'table table-bordered',
        tableContainer: 'table-responsive',
        tableHeading: 'fw-bold',
        tableSort: 'table-sort',
        tableSortAsc: 'table-sort-asc',
        tableSortDesc: 'table-sort-desc',
        topRow: 'd-md-flex justify-content-between mb-2',
    };
    /** @type {TableOptions} */
    static defaults = {
        buttons: [],
        layout: {
            top: 'search,buttons|length',
            bottom: 'info,pagination',
        },
        lang: {
            info: 'Showing results {start} to {end} of {total}',
            infoFiltered: 'Showing results {start} to {end} of {filtered} (filtered from {total} total)',
            noData: 'No data available',
            noResults: 'No results to show',
            page: 'Page',
            perPage: 'Per Page',
            search: 'Search',
            loading: 'Loading results',
            paginate: {
                first: 'First',
                last: 'Last',
                next: 'Next',
                previous: 'Previous',
            },
            buttons: {
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
        rowCallback: null,
        columns: null,
        order: [[0, 'asc']],
        lengths: [10, 25, 50, 100],
        length: 10,
        debounce: 250,
        info: true,
        lengthChange: true,
        ordering: true,
        paging: true,
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

    #columns = [];
    #container = null;
    #data = [];
    #domValues = new WeakMap();
    #drawVersion = 0;
    #filtered = 0;
    #headings = [];
    #id = false;
    #infoContainer = null;
    #lengthSelect = null;
    #limit;
    #loader = null;
    #loadResults = null;
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
    #results = [];
    #rowIndexes = [];
    #searchHandler = null;
    #searchInput = null;
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

            if (!this.options.getResults) {
                const data = this.options.data ?? getDomData(node, this.#domValues);
                validateRows(data);

                this.#data = data.slice();
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
        this.#data.push(Array.isArray(row) ? [...row] : { ...row });
        this.#mutated(1);
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
        this.#domValues = new WeakMap();
        this.#results = [];
        this.#rowIndexes = [];
        this.#offset = 0;
        this.#total = 0;
        this.#filtered = 0;
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

        const pending = this.#pending;
        this.#pending = null;

        // Clear the instance first so DOM removal events cannot dispose it again.
        super.dispose();

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

        this.#columns = [];
        this.#headings = [];
        this.#data = [];
        this.#domValues = new WeakMap();
        this.#results = [];
        this.#rowIndexes = [];

        this.#loadResults = null;
        this.#searchHandler = null;

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
        this.#data.splice(rowIndex, 1);
        this.#mutated(-1);
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

        for (const [index, rowIndex] of indexes.entries()) {
            $._setDot(this.#data[rowIndex], String(key), column[index]);
            this.#domValues.get(this.#data[rowIndex])?.delete(String(key));
        }

        this.#mutated();
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
        this.#data[rowIndex] = Array.isArray(row) ? [...row] : { ...row };
        this.#mutated();
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
        $._setDot(this.#data[rowIndex], String(key), value);
        this.#domValues.get(this.#data[rowIndex])?.delete(String(key));
        this.#mutated();
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

            $.addEventDelegate(this.#theadRow, 'click.ui.table', 'th', handleSort);

            $.addEventDelegate(this.#theadRow, 'keydown.ui.table', 'th', (event) => {
                switch (event.code) {
                    case 'Enter':
                    case 'NumpadEnter':
                    case 'Space':
                        handleSort(event);
                        break;
                }
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

        if (this.options.ordering) {
            request.order = { ...this.#getOrder().map(([column, dir]) => ({ column, dir })) };
        }

        if (this.options.paging) {
            request.offset = this.#offset;
            request.limit = this.#limit;
        }

        let response;

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
        this.#refreshResults();
        this.loading({ show: false });

        if (active()) {
            this.#renderResults();
        }
    }

    /**
     * Copies the headings and displayed rows required by an export button.
     * @param {TableButton} options The export button options.
     * @returns {{headings: string[], rows: Array<Array<*>>}|null} The export data, or null if interrupted.
     */
    #getExportData(options) {
        const version = this.#drawVersion;
        const columns = options.columns || this.#getVisibleColumns();

        for (const index of columns) {
            validateColumnIndex(index, this.#columns.length);
        }

        // Exports contain text, even when the displayed headings contain HTML.
        const headings = columns.map((index) => {
            const container = $.create('div');
            $.setHtml(container, $.sanitize(String(this.#headings[index].text)));

            return $.getText(container);
        });

        const rows = [];

        for (const rowIndex of this.#rowIndexes) {
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

        if (!this.#data.length && this.#offset) {
            this.#offset = Math.max(0, this.#offset - this.#limit);
            this.#load();

            return;
        }

        this.#refreshResults();
        this.loading({ show: false });

        if (this.node) {
            this.#renderResults();
        }
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
            $.append(this.node, this.#tfoot);
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

        const tableContainer = $.create('div', {
            class: this.constructor.classes.tableContainer,
        });

        $.append(tableContainer, this.node);
        $.append(this.#container, tableContainer);

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
                    this.constructor.buttons[button.type].call(this, button);
                }
            });

            $.append(btnGroup, btn);
        }

        $.append(container, btnGroup);
    }

    /**
     * Renders the table headings.
     */
    #renderHeadings() {
        const version = this.#drawVersion;
        const children = $.children(this.#theadRow);

        const headings = {};

        for (const child of children) {
            const index = $.getDataset(child, 'uiIndex');

            if (!this.#columns[index].visible) {
                $.detach(child);
            } else {
                headings[index] = child;
            }
        }

        let lastCell;

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
     * Renders the table results.
     */
    #renderResults() {
        if (!this.node) {
            return;
        }

        // User callbacks may dispose the table or draw again. Stop an older draw after each callback.
        const version = ++this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;
        $.triggerEvent(this.node, 'preDraw.ui.table');

        if (!active()) {
            return;
        }

        const proceed = this.options.preDrawCallback?.call(this);

        if (!active() || proceed === false) {
            return;
        }

        $.empty(this.#tbody);
        this.#renderHeadings();

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
            $.append(row, $.create('td', {
                class: this.constructor.classes.emptyCell,
                text: this.#term ? this.options.lang.noResults : this.options.lang.noData,
                attributes: {
                    colspan: Math.max(1, this.#getVisibleColumns().length),
                },
            }));
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

        this.options.drawCallback?.call(this);

        if (!active()) {
            return;
        }

        if (this.#tfoot) {
            this.options.footerCallback?.call(this, this.#tfoot, this.#data, this.#offset, end, [...this.#rowIndexes]);
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
     * Recomputes local matching, stable ordering, counts, and the current page.
     */
    #updateLocal() {
        const version = this.#drawVersion;
        const active = () => this.node && version === this.#drawVersion;
        const term = this.#term.toLocaleLowerCase();
        const order = this.options.ordering ? this.#getOrder() : [];
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

        // Resolve keys once per row so sorting does not repeatedly invoke renderers.
        const values = new Map();

        for (const rowIndex of indexes) {
            const row = [];

            for (const [index] of order) {
                const column = this.#columns[index];
                const raw = this.#getValue(rowIndex, index, 'sort');

                if (!active()) {
                    return;
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
            return;
        }

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
}
