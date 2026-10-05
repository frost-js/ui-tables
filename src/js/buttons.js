import $ from '@fr0st/query';
import { saveBlob } from './helpers.js';
import Workbook from './workbook/workbook.js';

/**
 * Downloads the displayed rows as CSV, escaping delimiters, quotes and line breaks.
 * @param {object} options The button options.
 * @param {string} [options.title] The download title.
 * @param {boolean} [options.escapeFormulae=true] Prefix spreadsheet formula-like strings with an apostrophe.
 * @param {object} data The export data.
 * @param {string[]} data.headings The headings.
 * @param {Array<Array<*>>} data.rows The displayed rows.
 */
export function csv(options, { headings, rows }) {
    const title = options.title || document.title;

    const lines = [headings, ...rows].map((row) => {
        const values = row.map((value) => {
            let text = String(value ?? '');

            // Spreadsheet programs interpret these string prefixes as formulas, even in CSV.
            if (options.escapeFormulae !== false && typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) {
                text = `'${text}`;
            }

            if (/[",\r\n]/.test(text)) {
                return `"${text.replaceAll('"', '""')}"`;
            }

            return text;
        });

        return values.join(',');
    });

    const blob = new Blob([lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
    });
    saveBlob(blob, `${title}.csv`);
}

/**
 * Downloads the displayed rows as an Excel workbook.
 * @param {object} options The button options.
 * @param {object} data The export data.
 * @param {string[]} data.headings The headings.
 * @param {Array<Array<*>>} data.rows The displayed rows.
 */
export function excel(options, { headings, rows }) {
    const workbook = new Workbook();
    workbook.addSheet({
        header: headings,
        rows,
    });
    saveBlob(workbook.create(), `${options.title || document.title}.xlsx`);
}

/**
 * Opens a text-only print view and waits for its styles and fonts.
 * @param {object} options The button options.
 * @param {HTMLTableElement} table The table to print.
 * @param {string} classes The table classes.
 * @returns {Promise<void>} Completion of print preparation, or nothing when blocked.
 */
export async function print(options, table, classes) {
    const win = window.open('', '_blank');

    if (!win) {
        return;
    }

    const title = options.title || document.title;
    win.document.title = title;
    win.document.documentElement.dir = $.getProperty(table, 'dir') || document.documentElement.dir;

    const heading = win.document.createElement('h1');
    $.setText(heading, title);
    $.addClass(table, classes || '');
    $.append(win.document.body, [heading, table]);

    const loads = [];

    // Copy styles into the popup and wait for external stylesheets before printing.
    for (const element of $.find('link[rel="stylesheet"], style')) {
        const clone = win.document.importNode(element, true);

        if ($.tagName(clone) === 'link') {
            $.setProperty(clone, 'href', $.getProperty(element, 'href'));

            loads.push(new Promise((resolve) => {
                $.addEventOnce(clone, 'load', resolve);
                $.addEventOnce(clone, 'error', resolve);
            }));
        }

        $.append(win.document.head, clone);
    }

    try {
        await Promise.all(loads);
        await win.document.fonts.ready;

        if (win.closed) {
            return;
        }

        win.focus();
        win.print();
    } finally {
        if (!win.closed) {
            win.close();
        }
    }
}
