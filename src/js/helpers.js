/** @import { TableColumn, TableOrder } from './table.js'; */

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
 * @returns {Array} The parsed data.
 */
export function getDomData(element) {
    const tbody = $.findOne('tbody', element);

    return $.children(tbody, 'tr').map(
        (row) => $.children(row, 'td').map((cell) => $.getHtml(cell)),
    );
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
 * Applies column defaults and validates the indexes used for alternate ordering.
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

    for (const column of normalized) {
        if (column.orderData !== null) {
            for (const index of column.orderData) {
                validateColumnIndex(index, normalized.length);
            }
        }
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
    if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row) && !$._isPlainObject(row))) {
        throw new TypeError('Results must be an array of arrays or plain objects.');
    }
}
