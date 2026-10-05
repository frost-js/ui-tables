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
 * Validates a local or remote row collection.
 * @param {Array<Array<*>|Record<string, *>>} rows The supplied rows.
 */
export function validateRows(rows) {
    if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row) && !$._isPlainObject(row))) {
        throw new TypeError('Results must be an array of arrays or plain objects.');
    }
}
