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
    #sValues;

    /**
     * New Workbook constructor.
     */
    constructor() {
        this.#current = 0;
        this.#sheets = [];
        this.#sKeys = {};
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
                        `<sheet name="${sheet.name}" sheetId="${index + 1}" state="visible" r:id="rId${index + 2}"/>`,
                    );

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
                    if (!this.#sValues.length) {
                        this.#sValues.push('No Data');
                    }

                    const strings = this.#sValues.map((string) =>
                        `<si><t>${string}</t></si>`,
                    ).join('\r\n');

                    template = template.replaceAll('{cnt}', `${this.#sValues.length}`);
                    template = template.replace('{strings}', strings);

                    zip.addFile(filename, template);
                    break;
                }
                case 'xl/worksheets/sheet1.xml': {
                    for (const [index, sheet] of this.#sheets.entries()) {
                        filename = `xl/worksheets/sheet${index + 1}.xml`;
                        const xml = this.#sheetToXml(sheet, template);

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
     * Convert a sheet object to an XML string.
     * @param {object} sheet The sheet.
     * @param {string} template The XML template.
     * @returns {string} The XML string.
     */
    #sheetToXml(sheet, template) {
        const colLengths = {};
        const cols = [];
        const rows = [];
        let currentRow = 0;

        const addRow = (data, forceStyle = null) => {
            currentRow++;

            let row = `<row r="${currentRow}">`;
            let currentCol = 0;

            for (let value of data) {
                currentCol++;

                if (currentRow === 1) {
                    colLengths[currentCol] = 0;
                }

                if (!value) {
                    continue;
                }

                const cName = colName(currentCol) + currentRow;

                value = `${value}`;

                const length = value.length;

                let cType; let cStyle; let cValue;

                if (value === '0' || /^[-+]?[1-9]\d{0,14}$/.test(value)) {
                    cValue = value.trimStart('+');
                    if (length > 10) {
                        cStyle = 1; // 0
                    }
                } else if (/^[-+]?(?:0|[1-9]\d*)\.\d+$/.test(value)) {
                    cValue = value.trimStart('+');
                } else if (/^[-+]?\d+%$/.test(value)) {
                    value = parseInt(value) / 100;
                    cValue = value.toFixed(2);
                    cStyle = 2; // 0%
                } else if (/^[-+]?\d+\.\d+%$/.test(value)) {
                    value = Math.round(parseFloat(value) * 100) / 10000;
                    cValue = value.toFixed(4);
                    cStyle = 3; // 0.00%
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    cValue = formatDate(match[1], match[2], match[3]);
                    cStyle = 4; // mm-dd-yy
                } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    cValue = formatDate(match[3], match[2], match[1]);
                    cStyle = 4; // mm-dd-yy
                } else if (/\d{2}:\d{2}:\d{2}$/.test(value)) {
                    const match = value.match(/(\d{2}):(\d{2}):(\d{2})$/);
                    cValue = formatDate(0, 0, 0, match[1], match[2], match[3]);
                    cStyle = 5; // h:mm
                } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
                    const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
                    cValue = formatDate(match[1], match[2], match[3], match[4], match[5], match[6]);
                    cStyle = 6; // m/d/yy h:mm
                } else if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(value)) {
                    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
                    cValue = formatDate(match[3], match[2], match[1], match[4], match[5], match[6]);
                    cStyle = 6; // m/d/yy h:mm
                } else if (length > 160) {
                    cType = 'inlineStr';
                    cValue = escape(value);
                } else {
                    if (/^[0-9+-.]+$/.test(value)) {
                        cStyle = 7; // align right
                    }

                    cType = 's'; // shared string

                    value = value.trimStart('\0');
                    value = escape(value);

                    const sKey = `~${value}`;

                    if (sKey in this.#sKeys) {
                        cValue = this.#sKeys[sKey];
                    } else {
                        this.#sValues.push(value);
                        cValue = this.#sValues.length - 1;
                        this.#sKeys[sKey] = cValue;
                    }
                }

                colLengths[currentCol] = Math.max(length, colLengths[currentCol]);

                const attributes = {
                    r: cName,
                };

                if (cType) {
                    attributes.t = cType;
                }

                if (forceStyle) {
                    cStyle = forceStyle;
                }

                if (cStyle) {
                    attributes.s = cStyle;
                }

                row += `<c ${Object.keys(attributes).map((attr) => `${attr}="${attributes[attr]}"`).join(' ')}>` +
                    (
                        cType === 'inlineStr' ?
                            `<is><t>${cValue}</t></is>` :
                            `<v>${cValue}</v>`
                    ) +
                    '</c>';
            }

            row += '</row>';
            rows.push(row);
        };

        if (sheet.data.header) {
            addRow(sheet.data.header, 8);
        }

        if (sheet.data.rows) {
            for (const data of sheet.data.rows) {
                addRow(data);
            }
        }

        if (sheet.data.footer) {
            addRow(sheet.data.footer, 8);
        }

        for (const [key, max] of Object.entries(colLengths)) {
            cols.push(`<col min="${key}" max="${key}" width="${Math.min(max + 5, 60)}" />`);
        }

        const ref = `A1:${colName(cols.length)}${rows.length}`;

        template = template.replace('{ref}', ref);
        template = template.replace('{cols}', cols.join('\r\n'));
        template = template.replace('{rows}', rows.join('\r\n'));

        return template;
    }
}
