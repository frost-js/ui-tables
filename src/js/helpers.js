import $ from '@fr0st/query';

/**
 * Build a data array from a DOM element.
 * @param {HTMLElement} element The element to parse.
 * @returns {Array} The parsed data.
 */
export function getDataFromDOM(element) {
    const tbody = $.findOne('tbody', element);
    return $.children(tbody, 'tr').map(
        (row) => $.children(row, 'td').map((cell) => $.getHtml(cell)),
    );
};

/**
 * Build a heading array from a DOM element.
 * @param {HTMLElement} element The element to parse.
 * @returns {Array} The parsed data.
 */
export function getHeadingsFromDOM(element) {
    const thead = element.tHead;
    if (!thead) {
        return [];
    }
    if (thead.rows.length > 1 || [...thead.querySelectorAll('th')].some((cell) => cell.colSpan !== 1 || cell.rowSpan !== 1)) {
        throw new RangeError('Table supports one heading row without spanning cells.');
    }
    const row = thead.rows[0];

    return $.children(row, 'th').map((cell) => ({
        text: $.getHtml(cell),
        class: $.getAttribute(cell, 'class'),
    }));
};

/**
 * Download a blob.
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
};
