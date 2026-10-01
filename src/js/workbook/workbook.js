import Zip from './../zip/zip.js';
import { colName, escape, formatDate } from './helpers.js';
import { templates } from './templates.js';

/**
 * Workbook Class
 * Based on https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
 * @class
 */
export default class Workbook {
    #current;
    #sheets;
    #sKeys;
    #stringCount = 0;
    #sValues;

    /**
     * New Workbook constructor.
     */
    constructor() {
        this.#current = 0;
        this.#sheets = [];
        this.#sKeys = new Map();
        this.#sValues = [];
    }

    /**
     * Add a sheet to the Workbook.
     * @param {object} data The sheet data.
     * @param {string} [name] The name of the sheet.
     */
    addSheet(data, name = null) {
        this.#current++;

        if (!name) {
            name = `Sheet${this.#current}`;
        }

        name = String(name).replace(/[\\/?*[\]:]/g, '').replace(/^'+|'+$/g, '').slice(0, 31) || `Sheet${this.#current}`;
        const base = name;
        let suffix = 1;
        while (this.#sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) {
            const tail = ` (${suffix++})`;
            name = base.slice(0, 31 - tail.length) + tail;
        }
        this.#sheets.push({
            name,
            data,
        });
    }

    /**
     * Create an xlsx file.
     * @returns {Blob} The xlsx file.
     */
    create() {
        if (!this.#sheets.length) {
            this.addSheet({ rows: [] });
        }
        this.#sKeys = new Map();
        this.#sValues = [];
        this.#stringCount = 0;
        const worksheets = this.#sheets.map((sheet) => this.#sheetToXml(sheet, templates['xl/worksheets/sheet1.xml']));
        const zip = new Zip('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        for (let [filename, template] of Object.entries(templates)) {
            switch (filename) {
                case '[Content_Types].xml': {
                    const override = this.#sheets.map((_, index) =>
                        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
                    ).join('');

                    template = template.replace('{sheets}', override);

                    zip.addFile(filename, template);
                    break;
                }
                case 'xl/_rels/workbook.xml.rels': {
                    let relationships = this.#sheets.map((_, index) =>
                        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>\n`,
                    ).join('');

                    relationships += `<Relationship Id="rId${this.#sheets.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;

                    template = template.replace('{sheets}', relationships);

                    zip.addFile(filename, template);
                    break;
                }
                case 'xl/workbook.xml': {
                    const sheets = this.#sheets.map((sheet, index) =>
                        `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" state="visible" r:id="rId${index + 2}"/>`,
                    ).join('');

                    template = template.replace('{sheets}', sheets);

                    zip.addFile(filename, template);
                    break;
                }
                case 'docProps/core.xml': {
                    const date = (new Date).toISOString().substring(0, 19) + 'Z';
                    template = template.replaceAll('{date}', date);

                    zip.addFile(filename, template);
                    break;
                }
                case 'xl/sharedStrings.xml': {
                    const strings = this.#sValues.map((string) =>
                        `<si><t xml:space="preserve">${string}</t></si>`,
                    ).join('\r\n');

                    template = template.replace('{cnt}', String(this.#stringCount)).replace('{unique}', String(this.#sValues.length));
                    template = template.replace('{strings}', strings);

                    zip.addFile(filename, template);
                    break;
                }
                case 'xl/worksheets/sheet1.xml': {
                    for (const [index, xml] of worksheets.entries()) {
                        filename = `xl/worksheets/sheet${index + 1}.xml`;

                        zip.addFile(filename, xml);
                    }

                    break;
                }
                default:
                    zip.addFile(filename, template);
                    break;
            }
        }

        return zip.zip();
    }

    /**
     * Serializes a value without interpreting strings as spreadsheet formulas.
     * @param {*} value The cell value.
     * @param {string} reference The cell reference.
     * @param {number|null} forceStyle The optional header/footer style.
     * @returns {string} The cell XML.
     */
    #cellToXml(value, reference, forceStyle) {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        let type = null;
        let style = forceStyle;
        let content;
        const text = String(value);
        if (typeof value === 'boolean') {
            type = 'b';
            content = value ? 1 : 0;
        } else if ((typeof value === 'number' && Number.isFinite(value)) || /^[-+]?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(text)) {
            content = Number(value);
        } else if (/^[-+]?\d+(?:\.\d+)?%$/.test(text)) {
            content = parseFloat(text) / 100;
            style ??= text.includes('.') ? 3 : 2;
        } else {
            const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
            const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
            const time = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
            try {
                if (iso || dmy) {
                    const match = iso || dmy;
                    content = formatDate(iso ? match[1] : match[3], match[2], iso ? match[3] : match[1], match[4] || 0, match[5] || 0, match[6] || 0);
                    style ??= match[4] ? 6 : 4;
                } else if (time) {
                    content = formatDate(0, 0, 0, ...time.slice(1));
                    style ??= 5;
                }
            } catch {
                // Keep invalid date-like values as strings instead of changing their meaning.
            }
            if (content === undefined) {
                const escaped = escape(text);
                if (text.length > 160) {
                    type = 'inlineStr';
                    content = escaped;
                } else {
                    type = 's';
                    this.#stringCount++;
                    if (!this.#sKeys.has(escaped)) {
                        this.#sKeys.set(escaped, this.#sValues.length);
                        this.#sValues.push(escaped);
                    }
                    content = this.#sKeys.get(escaped);
                }
            }
        }
        return `<c r="${reference}"${type ? ` t="${type}"` : ''}${style !== null ? ` s="${style}"` : ''}>` +
            (type === 'inlineStr' ? `<is><t xml:space="preserve">${content}</t></is>` : `<v>${content}</v>`) + '</c>';
    }

    /**
     * Convert a sheet object to an XML string.
     * @param {object} sheet The sheet.
     * @param {string} template The XML template.
     * @returns {string} The XML string.
     */
    #sheetToXml(sheet, template) {
        const widths = [];
        const rows = [];
        const data = [
            ...(sheet.data.header ? [{ values: sheet.data.header, style: 8 }] : []),
            ...(sheet.data.rows || []).map((values) => ({ values, style: null })),
            ...(sheet.data.footer ? [{ values: sheet.data.footer, style: 8 }] : []),
        ];
        if (data.length > 1048576) {
            throw new RangeError('Too many worksheet rows.');
        }
        for (const [index, { values, style }] of data.entries()) {
            if (!Array.isArray(values) || values.length > 16384) {
                throw new RangeError('Invalid worksheet row.');
            }
            const cells = values.map((value, column) => {
                widths[column] = Math.max(widths[column] || 0, String(value ?? '').length);
                return this.#cellToXml(value, `${colName(column + 1)}${index + 1}`, style);
            }).join('');
            rows.push(`<row r="${index + 1}">${cells}</row>`);
        }
        const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(width + 5, 60)}"/>`);
        const ref = rows.length && widths.length ? `A1:${colName(widths.length)}${rows.length}` : 'A1';
        return template.replace('{ref}', ref).replace('{cols}', cols.join('')).replace('{rows}', rows.join(''));
    }
}
