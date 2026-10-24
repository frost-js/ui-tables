/** @import { TableColumn, TableFilter, TableOrder } from './table.js'; */

import $ from '@fr0st/query';

/**
 * Builds a text-only table from export data.
 * @param {string[]} headings The column headings.
 * @param {Array<Array<*>>} rows The displayed rows.
 * @param {string} direction The table direction.
 * @returns {HTMLTableElement} The table element.
 */
export function buildTable(headings, rows, direction) {
    const table = $.create('table');
    $.setProperty(table, 'dir', direction);
    const thead = $.create('thead');
    const tr = $.create('tr');

    for (const heading of headings) {
        const th = $.create('th', {
            text: heading,
        });
        $.append(tr, th);
    }

    $.append(thead, tr);
    $.append(table, thead);

    const tbody = $.create('tbody');

    for (const row of rows) {
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
 * Builds a data array from a DOM element.
 * @param {HTMLElement} element The element to parse.
 * @param {WeakMap} values The cell metadata, keyed by source row.
 * @returns {Array} The parsed data.
 */
export function getDomData(element, values) {
    const tbody = $.findOne('tbody', element);

    return $.children(tbody, 'tr').map((row) => {
        const cells = $.children(row, 'td');
        const data = cells.map((cell) => $.getHtml(cell));
        const metadata = new Map(cells.map((cell, index) => {
            const text = $.getText(cell);

            return [String(index), {
                value: data[index],
                sort: $.getAttribute(cell, 'data-order') ?? text,
                filter: $.getAttribute(cell, 'data-search') ?? text,
                export: $.getAttribute(cell, 'data-export') ?? text,
            }];
        }));
        values.set(data, metadata);

        return data;
    });
}

/**
 * Builds a heading array from a DOM element.
 * @param {HTMLElement} element The element to parse.
 * @returns {Array} The parsed data.
 */
export function getDomHeadings(element) {
    const thead = $.getProperty(element, 'tHead');

    if (!thead) {
        return [];
    }

    const rows = $.getProperty(thead, 'rows');

    if (
        rows.length > 1 ||
        $.find('th', thead).some((cell) => $.getProperty(cell, 'colSpan') !== 1 || $.getProperty(cell, 'rowSpan') !== 1)
    ) {
        throw new RangeError('Table supports one heading row without spanning cells.');
    }

    const row = rows[0];

    return $.children(row, 'th').map((cell) => ({
        text: $.getHtml(cell),
        class: $.getAttribute(cell, 'class'),
    }));
}

/**
 * Matches a resolved cell value against a validated filter.
 * @param {*} value The resolved filter value.
 * @param {TableFilter} filter The column filter.
 * @param {string} type The column type.
 * @returns {boolean} Whether the value matches.
 */
export function matchesFilter(value, filter, type) {
    const typed = filter.operator !== 'contains' && (type === 'number' || type === 'date');
    const normalize = typed ?
        (value) => normalizeSortValue(value, type) :
        (value) => String(value ?? '').toLocaleLowerCase();
    const actual = normalize(value);
    const expected = Array.isArray(filter.value) ? filter.value.map(normalize) : normalize(filter.value);

    if (actual === null) {
        return false;
    }

    switch (filter.operator) {
        case 'contains':
            return actual.includes(expected);
        case 'equals':
            return actual === expected;
        case 'gt':
            return actual > expected;
        case 'gte':
            return actual >= expected;
        case 'lt':
            return actual < expected;
        case 'lte':
            return actual <= expected;
        case 'between':
            return actual >= expected[0] && actual <= expected[1];
    }
}

/**
 * Applies column defaults and validates value options and alternate ordering.
 * @param {TableColumn[]|null} columns The configured columns.
 * @param {{text: string, class: string|null}[]} headings The parsed headings.
 * @returns {TableColumn[]} The normalized columns.
 */
export function normalizeColumns(columns, headings) {
    columns ??= headings.map((_, data) => ({ data }));

    if (headings.length && columns.length !== headings.length) {
        throw new RangeError('Column definitions must match the heading count.');
    }

    const normalized = columns.map((column, index) => ({
        class: null,
        compare: null,
        data: index,
        dir: 'asc',
        format: null,
        name: null,
        orderData: null,
        orderable: true,
        render: null,
        searchable: true,
        type: 'auto',
        visible: true,
        createdCell: null,
        ...column,
    }));

    for (const column of normalized) {
        if (!['auto', 'string', 'number', 'date'].includes(column.type)) {
            throw new TypeError('Column type must be auto, string, number, or date.');
        }

        for (const callback of ['compare', 'format', 'render']) {
            if (column[callback] !== null && column[callback] !== undefined && typeof column[callback] !== 'function') {
                throw new TypeError(`Column ${callback} must be a function or null.`);
            }
        }

        if (column.format && column.render) {
            throw new TypeError('Columns cannot define both format and render.');
        }

        if (column.orderData !== null) {
            for (const index of column.orderData) {
                validateColumnIndex(index, normalized.length);
            }
        }
    }

    return normalized;
}

/**
 * Validates and copies structured filters before applying them.
 * @param {TableFilter[]} filters The requested filters.
 * @param {TableColumn[]} columns The normalized columns.
 * @returns {TableFilter[]} The copied filters.
 */
export function normalizeFilters(filters, columns) {
    if (!Array.isArray(filters)) {
        throw new TypeError('Filters must be an array.');
    }

    const normalized = [];

    for (const filter of filters) {
        if (!$._isPlainObject(filter)) {
            throw new TypeError('Filters must contain plain objects.');
        }

        const { column, operator, value } = filter;
        validateColumnIndex(column, columns.length);

        if (!columns[column].searchable) {
            throw new TypeError('Filters require a searchable column.');
        }

        if (!['contains', 'equals', 'gt', 'gte', 'lt', 'lte', 'between'].includes(operator)) {
            throw new TypeError('Filter operator is invalid.');
        }

        if (operator === 'between' && (!Array.isArray(value) || value.length !== 2)) {
            throw new TypeError('Between filters require two bounds.');
        }

        const values = operator === 'between' ? [...value] : [value];

        if (values.some((value) => value !== null && typeof value !== 'string' && typeof value !== 'boolean' &&
            (typeof value !== 'number' || !Number.isFinite(value)))) {
            throw new TypeError('Filter values must be JSON scalars.');
        }

        const type = columns[column].type;
        const typed = type === 'number' || type === 'date';

        if (!typed && operator !== 'contains' && operator !== 'equals') {
            throw new TypeError('Range filters require a number or date column.');
        }

        if (typed && operator !== 'contains') {
            const bounds = values.map((value) => normalizeSortValue(value, type));

            if (bounds.some((value) => value === null)) {
                throw new TypeError('Filter values must match the column type.');
            }

            if (operator === 'between' && bounds[0] > bounds[1]) {
                throw new RangeError('Filter bounds must be in ascending order.');
            }
        }

        normalized.push({ column, operator, value: operator === 'between' ? [...value] : value });
    }

    return normalized;
}

/**
 * Validates and copies ordering, ignoring nonorderable columns.
 * @param {TableOrder[]} order The requested order.
 * @param {TableColumn[]} columns The normalized columns.
 * @returns {TableOrder[]} The normalized order.
 */
export function normalizeOrder(order, columns) {
    if (!Array.isArray(order)) {
        throw new TypeError('Order must be an array.');
    }

    const normalized = [];

    for (const entry of order) {
        if (!Array.isArray(entry) || entry.length !== 2 || !['asc', 'desc'].includes(entry[1])) {
            throw new TypeError('Order entries must contain a column index and asc/desc direction.');
        }

        const [index, direction] = entry;

        // The default first-column order is harmless for a table with no columns.
        if (!columns.length && index === 0) {
            continue;
        }

        validateColumnIndex(index, columns.length);

        if (columns[index].orderable) {
            normalized.push([index, direction]);
        }
    }

    return normalized;
}

/**
 * Converts a page length to a positive integer for page offset calculations.
 * @param {number|string} length The requested page length.
 * @returns {number} The normalized length.
 */
export function normalizePageLength(length) {
    length = Number(length);

    // Zero or fractional lengths cannot produce valid page offsets.
    if (!Number.isSafeInteger(length) || length <= 0) {
        throw new RangeError('Page length must be a positive integer.');
    }

    return length;
}

/**
 * Converts an explicitly typed sort value, using null for missing values.
 * @param {*} value The resolved value.
 * @param {string} type The column type.
 * @returns {*} The normalized value.
 */
export function normalizeSortValue(value, type) {
    if (type === 'auto') {
        return value;
    }

    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
        return null;
    }

    switch (type) {
        case 'string':
            return String(value).toLocaleLowerCase();
        case 'number':
            value = typeof value === 'string' ? Number(value) : value;
            break;
        case 'date':
            value = parseDate(value);
            break;
    }

    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Parses a Date, epoch milliseconds, or an unambiguous ISO date string.
 * @param {*} value The date value.
 * @returns {number|null} The timestamp, or null for unsupported input.
 */
function parseDate(value) {
    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value !== 'string') {
        return typeof value === 'number' ? new Date(value).getTime() : null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(value);

    if (!match) {
        return null;
    }

    // Date.parse accepts overflow days, so validate the calendar date first.
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);

    if (date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) {
        return null;
    }

    return Date.parse(value);
}

/**
 * Downloads a blob.
 * @param {Blob} blob The blob to save.
 * @param {string} filename The filename.
 */
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = $.create('a', {
        attributes: {
            href: url,
            download: filename,
        },
    });

    try {
        $.append(document.body, link);
        $.click(link);
    } finally {
        $.detach(link);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

/**
 * Validates a data column index.
 * @param {number} index The column index.
 * @param {number} count The number of columns.
 */
export function validateColumnIndex(index, count) {
    if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new RangeError('Column index is out of range.');
    }
}

/**
 * Validates a local or remote row collection.
 * @param {Array<Array<*>|Record<string, *>>} rows The supplied rows.
 */
export function validateRows(rows) {
    if (!Array.isArray(rows)) {
        throw new TypeError('Results must be an array of arrays or plain objects.');
    }

    for (const row of rows) {
        if (!Array.isArray(row) && !$._isPlainObject(row)) {
            throw new TypeError('Results must be an array of arrays or plain objects.');
        }
    }
}
