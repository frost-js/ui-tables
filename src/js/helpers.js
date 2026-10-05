import $ from '@fr0st/query';

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

export { getDomData as getDataFromDOM, getDomHeadings as getHeadingsFromDOM };
