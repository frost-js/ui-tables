import $ from '@fr0st/query';
import { BaseComponent, generateId } from '@fr0st/ui';
import { csv, excel, print } from './buttons.js';
import { getDataFromDOM, getHeadingsFromDOM } from './helpers.js';

/** @typedef {Array<*>|Record<string, *>} TableRow */
/** @typedef {[number, 'asc'|'desc']} TableOrder */
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
 * @property {function(HTMLTableCellElement, *, TableRow, number, number): void} [createdCell] Receives a created cell.
 */
/**
 * @typedef {object} TableButton
 * @property {string} [type] The registered button type.
 * @property {string} [text] The button label.
 * @property {string} [title] The export title, defaulting to the document title.
 * @property {number[]} [columns] The columns to export; defaults to visible columns.
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
 * @property {TableButton[]} [buttons=[]] The export and custom buttons.
 * @property {{top?: string, bottom?: string}} [layout] Comma-separated columns containing pipe-separated controls.
 * @property {Record<string, string|Record<string, string>>} [lang] The interface labels.
 * @property {Record<string, string>} [icons] The pagination icons.
 * @property {'filled'|'outline'} [inputStyle='filled'] The generated input style.
 * @property {TableOrder[]} [order] The initial ordering; defaults to column zero ascending.
 * @property {number[]} [lengths] Available page lengths; defaults to 10, 25, 50, and 100.
 * @property {number} [length=10] The initial page length.
 * @property {number} [debounce=250] The remote request delay in milliseconds.
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
 * @property {function(): void} [preDrawCallback] The pre-draw callback, reserved for the data/lifecycle migration.
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
            csv(options, this.#getExportData(options));
        },
        excel(options) {
            excel(options, this.#getExportData(options));
        },
        print(options) {
            const columns = options.columns || this.#getVisibleColumns();
            print(options, this.#buildTable(columns), $.getAttribute(this.node, 'class'));
        },
    };
    // Table classes
    static classes = {
        bottomRow: 'd-md-flex justify-content-between mx-n2',
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
        lengthInputRipple: 'ripple-line',
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
        searchInputRipple: 'ripple-line',
        table: 'table table-bordered',
        tableContainer: 'table-responsive',
        tableHeading: 'fw-bold',
        tableSort: 'table-sort',
        tableSortAsc: 'table-sort-asc',
        tableSortDesc: 'table-sort-desc',
        topRow: 'd-md-flex justify-content-between mb-2 mx-n2',
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
            last: '&raquo',
            next: '&gt;',
            previous: '&lt;',
        },
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

    #columnCount;
    #columns;
    #container;
    #data;
    #filtered;
    #filterIndexes;
    #getData;
    #headings;
    #id;
    #index;
    #infoContainer;
    #lengthSelect;
    #limit;
    #loader;
    #offset;
    #order;
    #original;
    #originalClass;
    #originalDescription;
    #page;
    #pagination;
    #request;
    #results;
    #rowIndexes;
    #searchInput;
    #tbody;
    #term;
    #tfoot;
    #theadRow;
    #total;
    #totalPages;

    /**
     * New Table constructor.
     * @param {HTMLTableElement} node The input table.
     * @param {TableOptions} [options] The component options.
     */
    constructor(node, options) {
        super(node, options);

        this.#originalClass = $.getAttribute(this.node, 'class');
        this.#originalDescription = $.getAttribute(this.node, 'aria-describedby');

        this.#data = [];
        this.#results = [];
        this.#filtered = 0;
        this.#total = 0;

        this.#getData = null;

        let data;
        if (this.options.getResults) {
            this.#getResultsInit();
        } else if ($._isArray(this.options.data)) {
            data = this.options.data.slice();
        } else {
            data = getDataFromDOM(this.node);
        }

        if (data) {
            this.#data = data;
            this.#getDataInit();
        }

        this.#headings = getHeadingsFromDOM(this.node);

        this.#columns = [];

        if (this.options.columns) {
            this.#columns = this.options.columns.map((column) => ({ ...column }));
        } else {
            this.#columns = new Array(this.#headings.length).fill();
        }

        this.#columns = this.#columns.map((column, index) => ({
            class: null,
            data: index,
            dir: 'asc',
            format: null,
            name: null,
            orderData: null,
            orderable: true,
            searchable: true,
            visible: true,
            createdCell: null,
            ...column,
        }));

        this.#columnCount = this.#columns.reduce((acc, v) => {
            if (v.visible) {
                acc++;
            }

            return acc;
        }, 0);

        this.#offset = 0;
        this.#limit = this.options.paging ?
            this.options.length :
            Infinity;
        this.#order = this.options.order.map((order) => [...order]);
        this.#term = null;

        const id = $.getAttribute(this.node, 'id');

        if (!id) {
            $.setAttribute(this.node, { id: generateId('table') });
            this.#id = true;
        }

        this.#buildIndex();
        this.#render();
        this.#events();

        $.triggerEvent(this.node, 'init.ui.table');

        this.#getData();
    }

    /**
     * Add a row to the data array.
     * @param {Array|object} row The row to add.
     */
    addRow(row) {
        this.#data.push(row);
        this.#buildIndex();

        this.#total++;
        this.#filtered++;

        if (this.options.getResults) {
            this.#rowIndexes.push(this.#data.length - 1);

            this.#refreshResults();
            this.#renderResults();
        } else {
            this.#getData();
        }
    }

    /**
     * Clear all rows from the data array.
     */
    clear() {
        this.#data = [];
        this.#index = [];
        this.#filterIndexes = null;
        this.#rowIndexes = [];
        this.#results = [];
        this.#offset = 0;
        this.#total = 0;
        this.#filtered = 0;

        if (this.options.searching) {
            $.setValue(this.#searchInput, '');
        }

        this.#renderResults();
    }

    /**
     * Dispose the Table.
     */
    dispose() {
        if (!this.node) {
            return;
        }

        if (this.#id) {
            $.removeAttribute(this.node, 'id');
        }

        for (const [attribute, value] of [
            ['class', this.#originalClass],
            ['aria-describedby', this.#originalDescription],
        ]) {
            if (value === null || value === undefined) {
                $.removeAttribute(this.node, attribute);
            } else {
                $.setAttribute(this.node, { [attribute]: value });
            }
        }

        $.before(this.#container, this.node);
        $.remove(this.#container);
        $.empty(this.node);

        for (const child of $.children(this.#original)) {
            $.append(this.node, child);
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
        this.#columns = null;
        this.#headings = null;
        this.#order = null;
        this.#data = null;
        this.#index = null;
        this.#filterIndexes = null;
        this.#rowIndexes = null;
        this.#results = null;
        this.#request = null;
        this.#getData = null;

        super.dispose();
    }

    /**
     * Get values for a single column.
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
     * Get values for a single row.
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
     * Get a single value from a row.
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
     * Toggle a column as hidden.
     * @param {number} index The column index.
     */
    hideColumn(index) {
        this.#columns[index].visible = false;

        this.#renderResults();
    }

    /**
     * Get the Table information.
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
     * Set the Table length.
     * @param {number} length The length.
     */
    length(length) {
        if (!this.options.paging) {
            return;
        }

        this.#limit = length;
        this.#offset -= (this.#offset % this.#limit);

        $.triggerEvent(this.node, 'length.ui.table');

        this.#getData();
    }

    /**
     * Trigger the loading indicator.
     * @param {object} [options] Options for the loading indicator.
     * @param {boolean} [options.show=true] Whether to show the loading indicator.
     */
    loading({ show = true } = {}) {
        if (show) {
            $.triggerEvent(this.node, 'processing.ui.table');
            $.show(this.#loader);
        } else {
            $.hide(this.#loader);
            $.triggerEvent(this.node, 'processed.ui.table');
        }
    }

    /**
     * Set the Table order data.
     * @param {Array} order The order data.
     */
    order(order) {
        if (!this.options.ordering) {
            return;
        }

        this.#order = order;

        $.triggerEvent(this.node, 'order.ui.table');

        this.#getData();
    }

    /**
     * Set the Table page.
     * @param {number} page The one-based page number.
     */
    page(page) {
        if (!this.options.paging) {
            return;
        }

        this.#offset = (page - 1) * this.#limit;

        $.triggerEvent(this.node, 'page.ui.table');

        this.#getData();
    }

    /**
     * Redraw the Table.
     */
    refresh() {
        this.#renderResults();
    }

    /**
     * Reload the Table data.
     * @param {object} [options] Options for reloading the data
     * @param {boolean} [options.reset=false] Whether to reset the offset.
     */
    reload({ reset = false } = {}) {
        if (reset) {
            this.#offset = 0;
        }

        this.#getData();
    }

    /**
     * Remove a row from the data array.
     * @param {number} index The row index to remove.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    removeRow(index, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });

        this.#data = this.#data.filter((_, dataIndex) => dataIndex !== rowIndex);

        this.#buildIndex();
        this.#refreshResults();
        this.#renderResults();
    }

    /**
     * Search the Table for a term.
     * @param {string} term The term to search for.
     */
    search(term) {
        if (!this.options.searching) {
            return;
        }

        $.setValue(this.#searchInput, term);
        this.#term = term;

        $.triggerEvent(this.node, 'search.ui.table');

        if (this.options.getResults) {
            this.#getData();
            return;
        }

        if (this.#term) {
            this.#filterIndexes = [];

            const escapedFilter = $._escapeRegExp(this.#term);
            const regExp = new RegExp(escapedFilter, 'i');

            // filter results
            for (const [index, result] of this.#data.entries()) {
                for (const column of this.#columns) {
                    if (!column.searchable) {
                        continue;
                    }

                    const value = $._getDot(result, `${column.data}`);

                    if (regExp.test(value)) {
                        this.#filterIndexes.push(index);
                    }
                }
            }

            this.#filtered = this.#filterIndexes.length;
        } else {
            this.#filterIndexes = null;
            this.#filtered = this.#total;
        }

        this.#getData();
    }

    /**
     * Set values for a single column.
     * @param {string} key The key to set.
     * @param {Array} column The column values.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setColumn(key, column, { modified = true } = {}) {
        this.#data = this.#data.map((row, index) => {
            const rowIndex = modified ?
                this.#rowIndexes.findIndex((otherIndex) => otherIndex == index) :
                index;

            if (rowIndex >= 0) {
                $._setDot(row, `${key}`, column[rowIndex]);
            }

            return row;
        });

        this.#buildIndex();
        this.#refreshResults();
        this.#renderResults();
    }

    /**
     * Set values for a single row.
     * @param {number} index The row index to set.
     * @param {Array|object} row The row values.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setRow(index, row, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });

        this.#data[rowIndex] = row;

        this.#buildIndex();
        this.#refreshResults();
        this.#renderResults();
    }

    /**
     * Set a single value for a row.
     * @param {number} index The row index to set.
     * @param {string} key The key to set.
     * @param {*} value The value to set.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     */
    setValue(index, key, value, { modified = true } = {}) {
        const rowIndex = this.#getIndex(index, { modified });

        $._setDot(this.#data[rowIndex], `${key}`, value);

        this.#buildIndex();
        this.#refreshResults();
        this.#renderResults();
    }

    /**
     * Toggle a column as visible.
     * @param {number} index The column index.
     */
    showColumn(index) {
        this.#columns[index].visible = true;

        this.#renderResults();
    }

    /**
     * Rebuild the index.
     */
    #buildIndex() {
        if (this.options.getResults || !this.options.ordering) {
            return;
        }

        this.#index = [];
        for (const column of this.#columns) {
            if (!column.orderable) {
                continue;
            }

            this.#index[column.data] = [];

            const valueLookup = {};

            for (const [index, result] of this.#data.entries()) {
                const value = $._getDot(result, `${column.data}`);

                if (!(value in valueLookup)) {
                    valueLookup[value] = [];
                }

                valueLookup[value].push(index);
            }

            const values = Object.keys(valueLookup).sort((a, b) => {
                if ($._isNumeric(a) && $._isNumeric(b)) {
                    return a - b;
                }

                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                return aLower.localeCompare(bLower);
            });

            for (const value of values) {
                this.#index[column.data].push(valueLookup[value]);
            }
        }
    }

    /**
     * Render a table for specific columns.
     * @param {Array} columns The columns to render.
     * @returns {HTMLElement} The table element.
     */
    #buildTable(columns) {
        const table = $.create('table');
        const thead = $.create('thead');
        const tr = $.create('tr');

        for (const heading of this.#getHeadings(columns)) {
            const th = $.create('th', {
                text: heading,
            });
            $.append(tr, th);
        }

        $.append(thead, tr);
        $.append(table, thead);

        const tbody = $.create('tbody');
        for (const row of this.#getResultRows(columns)) {
            const tr = $.create('tr');

            for (const value of row) {
                const td = $.create('td', {
                    text: value,
                });
                $.append(tr, td);
            }

            $.append(tbody, tr);
        }

        $.append(table, tbody);

        return table;
    }

    /**
     * Attach events for the Table.
     */
    #events() {
        if (this.options.lengthChange) {
            $.addEvent(this.#lengthSelect, 'change.ui.table', (_) => {
                const length = $.getValue(this.#lengthSelect);
                this.length(length);
            });
        }

        if (this.options.searching) {
            $.addEvent(this.#searchInput, 'input.ui.table', $._debounce((_) => {
                const term = $.getValue(this.#searchInput);
                this.search(term);
            }));
        }

        if (this.options.ordering) {
            const handleSort = (e) => {
                const index = $.index(e.currentTarget);

                if (!this.#columns[index].orderable) {
                    return;
                }

                e.preventDefault();

                const defaultDir = this.#columns[index].dir;
                let currentDir = null;

                for (const [col, dir] of this.#order) {
                    if (col != index) {
                        continue;
                    }

                    currentDir = dir;
                    break;
                }

                let nextDir = defaultDir;
                if (currentDir === defaultDir) {
                    nextDir = defaultDir === 'asc' ?
                        'desc' :
                        'asc';
                }

                let order;
                if (e.shiftKey) {
                    if (!currentDir) {
                        order = [...this.#order, [index, nextDir]];
                    } else if (currentDir === defaultDir) {
                        order = this.#order.map(([col, dir]) => {
                            if (col == index) {
                                dir = nextDir;
                            }

                            return [col, dir];
                        });
                    } else {
                        order = this.#order.filter(([col]) => {
                            return col != index;
                        });
                    }
                } else {
                    order = [[index, nextDir]];
                }

                this.order(order);
            };

            $.addEventDelegate(this.#theadRow, 'click.ui.table', 'th', handleSort);

            $.addEventDelegate(this.#theadRow, 'keydown.ui.table', 'th', (e) => {
                switch (e.code) {
                    case 'Enter':
                    case 'NumpadEnter':
                    case 'Space':
                        handleSort(e);
                        break;
                }
            });
        }

        if (this.options.paging) {
            $.addEventDelegate(this.#pagination, 'click.ui.table', '[data-ui-page]', (e) => {
                e.preventDefault();

                let page = $.getDataset(e.currentTarget, 'uiPage');

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
     * Initialize preloaded get data.
     */
    #getDataInit() {
        this.#total = this.#data.length;
        this.#filtered = this.#total;

        this.#getData = (_) => {
            this.loading();

            this.#rowIndexes = this.#filterIndexes;

            // order
            if (this.options.ordering) {
                const order = this.#getOrder();
                this.#rowIndexes = this.#getOrderedIndexes(order, this.#rowIndexes);
            }

            if (!this.#rowIndexes) {
                this.#rowIndexes = $._range(this.#offset, this.#offset + this.#limit);
            }

            this.loading({ show: false });
            this.#refreshResults();
            this.#renderResults();
        };
    }

    /**
     * Copies the headings and displayed rows required by an export button.
     * @param {TableButton} options The export button options.
     * @returns {{headings: string[], rows: Array<Array<*>>}} The export data.
     */
    #getExportData(options) {
        const columns = options.columns || this.#getVisibleColumns();

        return {
            headings: this.#getHeadings(columns),
            rows: this.#getResultRows(columns),
        };
    }

    /**
     * Get headings for specific columns.
     * @param {Array} columns The columns to get.
     * @returns {Array} The headings.
     */
    #getHeadings(columns) {
        const headings = [];

        for (const [index, heading] of this.#headings.entries()) {
            if (!columns.includes(index)) {
                continue;
            }

            headings.push(heading.text);
        }

        return headings;
    }

    /**
     * Get an index (optionally modified).
     * @param {number} index The index to get.
     * @param {object} [options] Options for getting the row index.
     * @param {boolean} [options.modified=true] Whether to use modified indexes.
     * @returns {number} The index.
     */
    #getIndex(index, { modified = true } = {}) {
        return modified ?
            this.#rowIndexes[index] :
            index;
    }

    /**
     * Get real column ordering data.
     * @returns {Array} The column ordering data.
     */
    #getOrder() {
        const order = [];

        for (const [index, direction] of this.#order) {
            if (this.#columns[index].orderData) {
                order.push(...this.#columns[index.orderData]);
            } else {
                order.push([index, direction]);
            }
        }

        return order;
    }

    /**
     * Get a range of data indexes for filtered rows, based on order data.
     * @param {Array} order The order data.
     * @param {Array} [onlyRows=null] The filtered rows.
     * @param {number} [offset] The starting offset.
     * @param {number} [limit] The maximum rows to return.
     * @param {number} [orderIndex=0] The order index.
     * @returns {Array} The data indexes.
     */
    #getOrderedIndexes(order, onlyRows = null, offset = this.#offset, limit = this.#limit, orderIndex = 0) {
        const [index, direction] = order[orderIndex];
        const key = this.#columns[index].data;
        let rowLookup = this.#index[key];

        if (direction === 'desc') {
            rowLookup = rowLookup.slice().reverse();
        }

        let current = 0;
        const results = [];
        for (const rows of rowLookup) {
            let filteredRows = onlyRows ?
                rows.filter((row) => onlyRows.includes(row)) :
                rows;

            if (direction === 'desc') {
                filteredRows = filteredRows.slice().reverse();
            }

            if (offset > current + filteredRows.length || !filteredRows.length) {
                current += rows.length;
                continue;
            }

            const sortedRows = filteredRows.length > 1 && orderIndex < order.length - 1 ?
                this.#getOrderedIndexes(order, filteredRows, 0, Math.min(filteredRows.length, limit - results.length), orderIndex + 1) :
                rows;

            for (const row of sortedRows) {
                current++;

                if (current <= offset) {
                    continue;
                }

                results.push(row);

                if (results.length == limit) {
                    return results;
                }
            }
        }

        return results;
    }

    /**
     * Get results for specific columns.
     * @param {Array} columns The columns to get.
     * @returns {Array} The results.
     */
    #getResultRows(columns) {
        const rows = [];

        for (const result of this.#results) {
            const row = [];
            for (const [index, column] of this.#columns.entries()) {
                if (!columns.includes(index)) {
                    continue;
                }

                const value = $._getDot(result, `${column.data}`);

                row.push(value);
            }
            rows.push(row);
        }

        return rows;
    }

    /**
     * Initialize get data from callback.
     */
    #getResultsInit() {
        const load = $._debounce(() => {
            const options = {};

            if (this.#term) {
                options.term = this.#term;
            }

            if (this.options.ordering) {
                options.order = {
                    ...this.#order.map(([column, dir]) => ({ column, dir })),
                };
            }

            if (this.options.paging) {
                options.offset = this.#offset;
                options.limit = this.#limit;
            }

            options.columns = {
                ...this.#columns.map((column) => {
                    const data = {};

                    if (column.name) {
                        data.name = column.name;
                    }

                    return {
                        ...data,
                        data: column.data,
                        orderable: column.orderable,
                        searchable: column.searchable,
                    };
                }),
            };

            const request = Promise.resolve(this.options.getResults(options));

            request.then((response) => {
                if (this.#request !== request) {
                    return;
                }

                this.#total = response.total;
                this.#filtered = response.filtered;
                this.#data = response.results;

                this.#refreshResults();
                this.#rowIndexes = $._range(0, this.#results.length - 1);

                this.loading({ show: false });
                this.#renderResults();

                this.#request = null;
            }).catch((_) => {
                if (this.#request !== request) {
                    return;
                }

                this.loading({ show: false });

                this.#request = null;
            });

            this.#request = request;
        }, this.options.debounce);

        this.#getData = (_) => {
            // cancel last request
            if (this.#request && this.#request.cancel) {
                this.#request.cancel();
            }

            this.#request = null;

            this.loading();

            load();
        };
    }

    /**
     * Get the visible columns.
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
     * Refresh the results.
     */
    #refreshResults() {
        if (this.options.getResults) {
            this.#results = this.#data;
        } else {
            this.#results = this.#rowIndexes.map((rowIndex) => this.#data[rowIndex]);
        }

        if (this.options.paging) {
            this.#page = 1 + (this.#offset / this.#limit);
            this.#totalPages = Math.ceil(this.#filtered / this.#limit) || 1;
        }
    }

    /**
     * Render the Table.
     */
    #render() {
        this.#original = $.clone(this.node);
        $.empty(this.node);

        this.#container = $.create('div', {
            class: this.constructor.classes.container,
        });

        this.#loader = $.create('div', {
            class: this.constructor.classes.loader,
        });

        const loaderIcon = $.create('span', {
            class: this.constructor.classes.loaderIcon,
        });
        $.append(this.#loader, loaderIcon);

        $.addClass(this.node, this.constructor.classes.table);

        const thead = $.create('thead');
        $.append(this.node, thead);

        this.#theadRow = $.create('tr');
        $.append(thead, this.#theadRow);

        this.#tbody = $.create('tbody');
        $.append(this.node, this.#tbody);

        const tfoot = $.findOne('tfoot', this.#original);
        if (tfoot) {
            this.#tfoot = $.clone(tfoot);
            $.append(this.node, this.#tfoot);
        }

        $.hide(this.#loader);
        $.after(this.node, this.#container);
        $.append(this.#container, this.#loader);

        if (this.options.layout.top) {
            this.#renderLayoutRow(this.options.layout.top, this.constructor.classes.topRow);
        }

        const tableContainer = $.create('div', {
            class: this.constructor.classes.tableContainer,
        });

        $.append(tableContainer, this.node);
        $.append(this.#container, tableContainer);

        if (this.options.layout.bottom) {
            this.#renderLayoutRow(this.options.layout.bottom, this.constructor.classes.bottomRow);
        }
        if (this.#infoContainer) {
            $.setAttribute(this.node, {
                'aria-describedby': $.getAttribute(this.#infoContainer, 'id'),
            });
        }
    }

    /**
     * Render the table buttons.
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

            $.addEvent(btn, 'click.ui.table', (e) => {
                e.preventDefault();

                if (button.callback) {
                    button.callback.bind(this)();
                } else if (button.type in this.constructor.buttons) {
                    this.constructor.buttons[button.type].bind(this)(button);
                }
            });

            $.append(btnGroup, btn);
        }

        $.append(container, btnGroup);
    }

    /**
     * Render the table headings.
     */
    #renderHeadings() {
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
                cell = $.create('th', {
                    class: this.constructor.classes.tableHeading,
                    html: heading.text,
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

                if (!lastCell) {
                    $.append(this.#theadRow, cell);
                } else {
                    $.insertAfter(cell, lastCell);
                }
            }

            lastCell = cell;

            if (!this.options.ordering || !this.#columns[index].orderable) {
                continue;
            }

            let dir;
            for (const order of this.#order) {
                if (order[0] != index) {
                    continue;
                }

                dir = order[1];
                break;
            }

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
     * Render the table info.
     */
    #renderInfo() {
        $.empty(this.#infoContainer);

        const start = this.#offset + 1;
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
            infoText = this.options.infoCallback(start, end, this.#total, this.#filtered, infoText);
        }

        const text = $.create('small', {
            text: infoText,
        });
        $.append(this.#infoContainer, text);
    }

    /**
     * Render the table info container in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderInfoContainer(container) {
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
     * Render a layout row in a container.
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
                if (!(element in this.constructor.layout)) {
                    continue;
                }

                const container = $.create('div', {
                    class: this.constructor.classes.columnContainer,
                });

                this.constructor.layout[element].bind(this)(container);

                $.append(column, container);
            }

            $.append(row, column);
        }

        $.append(this.#container, row);
    }

    /**
     * Render the length select in a container.
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

            if (length == this.#limit) {
                $.setAttribute(option, { checked: true });
            }

            $.append(this.#lengthSelect, option);
        }

        if (this.options.inputStyle === 'filled') {
            const ripple = $.create('div', {
                class: this.constructor.classes.lengthInputRipple,
            });
            $.append(inputContainer, ripple);
        }

        $.append(container, lengthContainer);
    }

    /**
     * Render a pagination item.
     * @param {object} options Options for rendering the pagnination item.
     * @returns {HTMLElement} The pagnination item.
     */
    #renderPageItem(options) {
        const container = $.create('div', {
            class: this.constructor.classes.pageItem,
        });

        const link = $.create('button', {
            html: options.icon || options.text || options.page,
            class: this.constructor.classes.pageLink,
            attributes: {
                'type': 'button',
                'title': options.text ?
                    `${options.text} ${this.options.lang.page}` :
                    `${this.options.lang.page} ${options.page}`,
                'role': 'link',
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
     * Render the pagination.
     */
    #renderPagination() {
        const setDisabled = (container, disabled) => {
            const link = $.findOne(':scope > [data-ui-page]', container);

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

        setDisabled(firstPage, this.#page == 1);
        setDisabled(prevPage, this.#page == 1);
        setDisabled(nextPage, this.#page == this.#totalPages);
        setDisabled(lastPage, this.#page == this.#totalPages);

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

            if (current == this.#page) {
                $.addClass(pageItem, this.constructor.classes.pageActive);
            } else {
                $.removeClass(pageItem, this.constructor.classes.pageActive);
            }

            lastLink = pageItem;
        }
    }

    /**
     * Render the pagination container in a container.
     * @param {HTMLElement} container The container to render in.
     */
    #renderPaginationContainer(container) {
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
     * Render the table results.
     */
    #renderResults() {
        $.triggerEvent(this.node, 'preDraw.ui.table');

        $.empty(this.#tbody);

        this.#renderHeadings();

        if (this.options.headerCallback) {
            this.options.headerCallback(this.#theadRow, this.#data, this.#offset, this.#offset + this.#limit, this.#rowIndexes);
        }

        if (this.options.paging) {
            this.#renderPagination();
        }

        if (this.options.info) {
            this.#renderInfo();
        }

        if (!this.#results.length) {
            const row = $.create('tr');

            const cell = $.create('td', {
                class: this.constructor.classes.emptyCell,
                html: this.#term ?
                    this.options.lang.noResults :
                    this.options.lang.noData,
                attributes: {
                    colspan: this.#columnCount,
                },
            });
            $.append(row, cell);

            $.append(this.#tbody, row);
        } else {
            for (const [index, result] of this.#results.entries()) {
                const row = this.#renderRow(result, index);

                if (this.options.rowCallback) {
                    this.options.rowCallback(row, result, index, this.#offset + index, this.#rowIndexes[index]);
                }

                $.append(this.#tbody, row);

                if (this.options.createdRow) {
                    this.options.createdRow(row, result, index);
                }
            }
        }

        if (this.options.drawCallback) {
            this.options.drawCallback();
        }

        if (this.#tfoot && this.options.footerCallback) {
            this.options.footerCallback(this.#tfoot, this.#data, this.#offset, this.#offset + this.#limit, this.#rowIndexes);
        }

        $.triggerEvent(this.node, 'draw.ui.table');
    }

    /**
     * Render a result row.
     * @param {Array|object} data The row data.
     * @param {number} rowIndex The row index.
     * @returns {HTMLElement} The table row.
     */
    #renderRow(data, rowIndex) {
        const row = $.create('tr');

        for (const [index, column] of this.#columns.entries()) {
            if (!column.visible) {
                continue;
            }

            const value = $._getDot(data, `${column.data}`);

            const cell = $.create('td', {
                html: column.format ?
                    column.format(value) :
                    value,
            });

            if (column.class) {
                $.addClass(column.class);
            }

            if (column.createdCell) {
                column.createdCell(cell, value, data, rowIndex, index);
            }

            $.append(row, cell);
        }

        return row;
    }

    /**
     * Render the search in a container.
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
                'aria-controls': $.getAttribute(this.node, 'id'),
            },
        });
        $.append(inputContainer, this.#searchInput);

        if (this.options.inputStyle === 'filled') {
            const ripple = $.create('div', {
                class: this.constructor.classes.searchInputRipple,
            });
            $.append(inputContainer, ripple);
        }

        $.append(container, searchContainer);
    }
}
