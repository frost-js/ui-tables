import $ from '@fr0st/query';

/**
 * Builds a text-only table from export data.
 * @param {string[]} headings The column headings.
 * @param {Array<Array<*>>} rows The selected rows.
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
 * @param {HTMLTableElement} element The table to parse.
 * @param {WeakMap<string[], Map<string, {value: string, sort: string, filter: string, export: string}>>} values The cell metadata, keyed by source row.
 * @returns {string[][]} The parsed rows.
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
 * @param {HTMLTableElement} element The table to parse.
 * @returns {Array<{text: string, class: string|null}>} The parsed headings.
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
 * Maps footer cells to original data columns, accounting for spanning cells.
 * @param {HTMLTableSectionElement} footer The cloned footer.
 * @returns {Array<{cell: HTMLTableCellElement, columns: number[], hidden: boolean}>} The cell metadata.
 */
export function getFooterCells(footer) {
    const cells = [];
    const occupied = [];

    for (const [rowIndex, row] of [...footer.rows].entries()) {
        let index = 0;

        for (const cell of row.cells) {
            while (occupied[index] > rowIndex) {
                index++;
            }

            const columns = Array.from({ length: cell.colSpan }, (_, offset) => index + offset);
            const end = cell.rowSpan ? rowIndex + cell.rowSpan : footer.rows.length;

            for (const column of columns) {
                occupied[column] = end;
            }

            cells.push({ cell, columns, hidden: cell.hidden });
            index += cell.colSpan;
        }
    }

    return cells;
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
