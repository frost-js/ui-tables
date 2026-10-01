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
    const lines = [headings, ...rows].map((row) => row.map((value) => {
        let text = String(value ?? '');
        if (options.escapeFormulae !== false && typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) {
            text = `'${text}`;
        }
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(','));
    saveBlob(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), `${title}.csv`);
};

/**
 * Downloads the displayed rows as an Excel workbook.
 * @param {object} options The button options.
 * @param {object} data The export data.
 * @param {string[]} data.headings The headings.
 * @param {Array<Array<*>>} data.rows The displayed rows.
 */
export function excel(options, { headings, rows }) {
    const workbook = new Workbook();
    workbook.addSheet({ header: headings, rows });
    saveBlob(workbook.create(), `${options.title || document.title}.xlsx`);
};

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
    win.document.documentElement.dir = table.dir || document.documentElement.dir;
    const heading = win.document.createElement('h1');
    heading.textContent = title;
    $.addClass(table, classes || '');
    win.document.body.append(heading, table);
    const loads = [];
    for (const element of document.querySelectorAll('link[rel="stylesheet"], style')) {
        const clone = win.document.importNode(element, true);
        if (clone.tagName === 'LINK') {
            clone.href = element.href;
            loads.push(new Promise((resolve) => {
                clone.addEventListener('load', resolve, { once: true });
                clone.addEventListener('error', resolve, { once: true });
            }));
        }
        win.document.head.append(clone);
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
};
