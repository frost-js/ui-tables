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
    const tbody = $.findOne('thead', element);
    const row = $.children(tbody, 'tr').shift();

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
    const link = $.create('a', {
        attributes: {
            href: URL.createObjectURL(blob),
            download: filename,
        },
    });
    $.append(document.body, link);
    $.click(link);
    $.detach(link);
};
