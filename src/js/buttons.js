import $ from '@fr0st/query';
import { saveBlob } from './helpers.js';
import Workbook from './workbook/workbook.js';

/**
 * Generate a CSV file from the table.
 * @param {object} options The button options.
 * @param {object} data The headings and displayed rows.
 * @param {string[]} data.headings The exported headings.
 * @param {Array<Array<*>>} data.rows The displayed row values.
 */
export function csv(options, { headings, rows: results }) {
    if (!options.title) {
        options.title = $.getText('title');
    }

    const rows = [
        headings,
        ...results,
    ];

    // build csv data
    const lines = [];

    for (const row of rows) {
        const line = row.map(
            (value) => {
                value = `${value}`.replace(/"/g, '""');

                if (value.indexOf(',') >= 0) {
                    return `"${value}"`;
                }

                return value;
            },
        ).join(',');

        lines.push(line);
    }

    const blob = new Blob(
        [
            lines.join('\r\n'),
        ],
        { type: 'text/csv;charset=utf-8;' },
    );

    saveBlob(blob, `${options.title}.csv`);
};
/**
 * Generate an excel file from the table.
 * @param {object} options The button options.
 * @param {object} data The headings and displayed rows.
 * @param {string[]} data.headings The exported headings.
 * @param {Array<Array<*>>} data.rows The displayed row values.
 */
export function excel(options, { headings, rows: results }) {
    if (!options.title) {
        options.title = $.getText('title');
    }

    const workbook = new Workbook();
    workbook.addSheet({
        header: headings,
        rows: results,
    });

    const blob = workbook.create();

    saveBlob(blob, `${options.title}.xlsx`);
};

/**
 * Print the table.
 * @param {object} options The button options.
 * @param {HTMLTableElement} table The table to print.
 * @param {string} classes The table classes.
 */
export function print(options, table, classes) {
    if (!options.title) {
        options.title = $.getText('title');
    }

    const win = window.open('', '');

    win.document.head.innerHTML = `<title>${options.title}</title>`;

    const styles = $.find('link, style');
    const newStyles = $.clone(styles);

    for (const element of newStyles) {
        if ($.tagName(element) === 'link') {
            const oldRel = $.getAttribute(element, 'href');
            const href = (new URL(oldRel, document.location)).href;
            $.setAttribute(element, { href });
        }
        win.document.head.appendChild(element);
    }

    const container = $.create('div');
    $.addClass(table, classes);
    $.append(container, table);
    const tableHtml = $.getHtml(container);
    win.document.body.innerHTML = `<h1>${options.title}</h1>${tableHtml}`;

    setTimeout((_) => {
        win.print();
        win.close();
    }, 1000);
};
