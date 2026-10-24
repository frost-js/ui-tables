import Zip from '../zip/zip.js';
import { colName, escape, formatDate } from './helpers.js';
import { templates } from './templates.js';

// These indexes match the cellXfs entries in the workbook's styles template.
const cellStyles = {
    percent: 2,
    decimalPercent: 3,
    date: 4,
    time: 5,
    dateTime: 6,
    heading: 8,
};

/**
 * Builds Excel workbooks from rows, headings, and optional footers.
 * Adapted from https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
 */
export default class Workbook {
    #sheetCount = 0;
    #sheets = [];
    #stringCount = 0;
    #stringIndexes = new Map();
    #strings = [];

    /**
     * Adds a sheet to the Workbook.
     * @param {{header?: Array<*>, rows?: Array<Array<*>>, footer?: Array<*>}} data The sheet rows and optional headings and footer.
     * @param {string|null} [name=null] The sheet name; null generates a name.
     */
    addSheet(data, name = null) {
        this.#sheetCount++;

        if (!name) {
            name = `Sheet${this.#sheetCount}`;
        }

        // Excel sheet names must be unique, at most 31 characters, and exclude these characters.
        name = String(name)
            .replace(/[\\/?*[\]:]/g, '')
            .replace(/^'+|'+$/g, '')
            .slice(0, 31) || `Sheet${this.#sheetCount}`;

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
     * Creates an xlsx file.
     * @returns {Blob} The xlsx file.
     */
    create() {
        if (!this.#sheets.length) {
            this.addSheet({ rows: [] });
        }

        this.#stringIndexes = new Map();
        this.#strings = [];
        this.#stringCount = 0;

        // Serialize sheets first so all shared strings are available when writing their template.
        const worksheetTemplate = templates['xl/worksheets/sheet1.xml'];
        const worksheets = this.#sheets.map((sheet) => this.#sheetToXml(sheet, worksheetTemplate));

        const zip = new Zip('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        for (const [filename, source] of Object.entries(templates)) {
            let template = source;

            switch (filename) {
                case '[Content_Types].xml': {
                    const override = this.#sheets.map((_, index) =>
                        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ` +
                        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
                    ).join('');

                    template = template.replace('{sheets}', override);

                    break;
                }

                case 'xl/_rels/workbook.xml.rels': {
                    let relationships = this.#sheets.map((_, index) =>
                        `<Relationship Id="rId${index + 2}" ` +
                        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
                        `Target="worksheets/sheet${index + 1}.xml"/>\n`,
                    ).join('');

                    relationships += `<Relationship Id="rId${this.#sheets.length + 3}" ` +
                        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" ' +
                        'Target="sharedStrings.xml"/></Relationships>';

                    template = template.replace('{sheets}', relationships);

                    break;
                }

                case 'xl/workbook.xml': {
                    const sheets = this.#sheets.map((sheet, index) =>
                        `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" ` +
                        `state="visible" r:id="rId${index + 2}"/>`,
                    ).join('');

                    template = template.replace('{sheets}', () => sheets);

                    break;
                }

                case 'docProps/core.xml': {
                    const date = (new Date()).toISOString().substring(0, 19) + 'Z';

                    template = template.replaceAll('{date}', date);

                    break;
                }

                case 'xl/sharedStrings.xml': {
                    const strings = this.#strings.map((string) =>
                        `<si><t xml:space="preserve">${string}</t></si>`,
                    ).join('\r\n');

                    template = template
                        .replace('{cnt}', String(this.#stringCount))
                        .replace('{unique}', String(this.#strings.length))
                        .replace('{strings}', () => strings);

                    break;
                }

                case 'xl/worksheets/sheet1.xml': {
                    for (const [index, xml] of worksheets.entries()) {
                        zip.addFile(`xl/worksheets/sheet${index + 1}.xml`, xml);
                    }

                    continue;
                }

                default:
                    break;
            }

            zip.addFile(filename, template);
        }

        return zip.zip();
    }

    /**
     * Serializes a value without interpreting strings as spreadsheet formulas.
     * @param {*} value The cell value.
     * @param {string} reference The cell reference.
     * @param {number|null} defaultStyle The optional header/footer style.
     * @returns {string} The cell XML.
     */
    #cellToXml(value, reference, defaultStyle) {
        if (value === null || value === undefined || value === '') {
            return '';
        }

        let type = null;
        let style = defaultStyle;
        let content;
        const text = String(value);

        if (typeof value === 'boolean') {
            type = 'b';
            content = value ? 1 : 0;
        } else if (
            (typeof value === 'number' && Number.isFinite(value)) ||
            /^[-+]?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(text)
        ) {
            content = Number(value);
        } else if (/^[-+]?\d+(?:\.\d+)?%$/.test(text)) {
            content = Number.parseFloat(text) / 100;
            style ??= text.includes('.') ? cellStyles.decimalPercent : cellStyles.percent;
        } else {
            const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
            const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
            const time = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);

            try {
                if (iso || dmy) {
                    const match = iso || dmy;
                    const year = iso ? match[1] : match[3];
                    const day = iso ? match[3] : match[1];

                    content = formatDate(
                        year,
                        match[2],
                        day,
                        match[4] || 0,
                        match[5] || 0,
                        match[6] || 0,
                    );
                    style ??= match[4] ? cellStyles.dateTime : cellStyles.date;
                } else if (time) {
                    content = formatDate(0, 0, 0, ...time.slice(1));
                    style ??= cellStyles.time;
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
                    // Reuse short strings across cells; long strings stay inline in the worksheet.
                    type = 's';
                    this.#stringCount++;

                    if (!this.#stringIndexes.has(escaped)) {
                        this.#stringIndexes.set(escaped, this.#strings.length);
                        this.#strings.push(escaped);
                    }

                    content = this.#stringIndexes.get(escaped);
                }
            }
        }

        let attributes = `r="${reference}"`;

        if (type) {
            attributes += ` t="${type}"`;
        }

        if (style !== null) {
            attributes += ` s="${style}"`;
        }

        const cellValue = type === 'inlineStr' ?
            `<is><t xml:space="preserve">${content}</t></is>` :
            `<v>${content}</v>`;

        return `<c ${attributes}>${cellValue}</c>`;
    }

    /**
     * Converts a sheet object to an XML string.
     * @param {object} sheet The sheet.
     * @param {string} template The XML template.
     * @returns {string} The XML string.
     */
    #sheetToXml(sheet, template) {
        const widths = [];
        const rows = [];
        const data = [];

        if (sheet.data.header) {
            data.push({
                values: sheet.data.header,
                style: cellStyles.heading,
            });
        }

        for (const values of sheet.data.rows || []) {
            data.push({
                values,
                style: null,
            });
        }

        if (sheet.data.footer) {
            data.push({
                values: sheet.data.footer,
                style: cellStyles.heading,
            });
        }

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

        const columns = widths.map((width, index) => {
            const column = index + 1;
            const paddedWidth = Math.min(width + 5, 60);

            return `<col min="${column}" max="${column}" width="${paddedWidth}"/>`;
        });
        const reference = rows.length && widths.length ? `A1:${colName(widths.length)}${rows.length}` : 'A1';

        return template
            .replace('{ref}', reference)
            .replace('{cols}', columns.join(''))
            .replace('{rows}', () => rows.join(''));
    }
}
