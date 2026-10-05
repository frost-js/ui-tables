import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';

/** @import { Download } from '@playwright/test'; */

/**
 * Reads and independently verifies classic ZIP local entries against their directory.
 * @param {Uint8Array} bytes The archive bytes.
 * @returns {Map<string, {text: string, method: number, date: number, flags: number}>} The decoded entries.
 */
export function readZip(bytes) {
    const buffer = Buffer.from(bytes);
    const files = new Map();
    let offset = 0;

    // Decode each payload with Node's inflater and verify its size and CRC independently.
    while (buffer.readUInt32LE(offset) === 0x04034b50) {
        const method = buffer.readUInt16LE(offset + 8);
        const size = buffer.readUInt32LE(offset + 18);
        const nameLength = buffer.readUInt16LE(offset + 26);
        const start = offset + 30 + nameLength + buffer.readUInt16LE(offset + 28);
        const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
        const payload = buffer.subarray(start, start + size);
        const data = method === 8 ? inflateRawSync(payload) : payload;

        assert.equal(data.length, buffer.readUInt32LE(offset + 22));

        let crc = 0xffffffff;
        for (const byte of data) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) {
                crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
            }
        }
        assert.equal((crc ^ 0xffffffff) >>> 0, buffer.readUInt32LE(offset + 14));
        files.set(name, {
            text: data.toString('utf8'),
            method,
            flags: buffer.readUInt16LE(offset + 6),
            date: buffer.readUInt16LE(offset + 12),
            offset,
        });
        offset = start + size;
    }

    // Check that the central directory refers to the local entries we just decoded.
    const directory = offset;
    let count = 0;

    while (buffer.readUInt32LE(offset) === 0x02014b50) {
        const length = buffer.readUInt16LE(offset + 28);
        const name = buffer.toString('utf8', offset + 46, offset + 46 + length);
        assert.equal(buffer.readUInt32LE(offset + 42), files.get(name).offset);
        offset += 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
        count++;
    }

    assert.equal(buffer.readUInt32LE(offset), 0x06054b50);
    assert.equal(buffer.readUInt32LE(offset + 16), directory);
    assert.equal(buffer.readUInt32LE(offset + 12), offset - directory);
    assert.equal(buffer.readUInt16LE(offset + 10), count);
    assert.equal(count, files.size);

    return files;
}

/**
 * Collects a Playwright download without filesystem-specific paths.
 * @param {Download} download The download.
 * @returns {Promise<Buffer>} The downloaded bytes.
 */
export async function readDownload(download) {
    const chunks = [];

    for await (const chunk of await download.createReadStream()) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/**
 * Parses RFC-style CSV fields, including doubled quotes and embedded newlines.
 * @param {string} text The CSV text.
 * @returns {string[][]} The rows.
 */
export function readCsv(text) {
    const rows = [[]];
    let field = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '"') {
            if (quoted && text[index + 1] === '"') {
                field += '"';
                index++;
            } else {
                quoted = !quoted;
            }
        } else if (!quoted && (char === ',' || char === '\r' || char === '\n')) {
            rows.at(-1).push(field);
            field = '';
            if (char !== ',') {
                if (char === '\r' && text[index + 1] === '\n') {
                    index++;
                }
                rows.push([]);
            }
        } else {
            field += char;
        }
    }

    rows.at(-1).push(field);
    assert.equal(quoted, false);
    return rows;
}

/**
 * Parses exported XML and reads the first worksheet in the browser.
 * Pass this function to page.evaluate with the entries returned by readZip.
 * @param {Array} entries The decoded archive entries.
 * @returns {object} The XML validity, shared strings, rows, and cell metadata.
 */
export function readWorksheet(entries) {
    const xml = Object.fromEntries(entries.map(([name, file]) => [
        name,
        new DOMParser().parseFromString(file.text, 'application/xml'),
    ]));
    const valid = Object.values(xml).every((doc) => !$.findOne('parsererror', doc));
    const strings = $.find('si', xml['xl/sharedStrings.xml']).map((item) => $.getText(item));
    const sheet = xml['xl/worksheets/sheet1.xml'];

    // Long strings are stored inline; other cells contain a value or shared-string index.
    const cells = Object.fromEntries($.find('c', sheet).map((cell) => [
        $.getAttribute(cell, 'r'),
        {
            value: $.getText($.findOne('v, is t', cell)),
            type: $.getAttribute(cell, 't'),
        },
    ]));

    const rows = $.find('row', sheet).slice(1).map((row) => {
        return $.find('c', row).map((cell) => {
            const { value, type } = cells[$.getAttribute(cell, 'r')];
            return type === 's' ? strings[Number(value)] : value;
        });
    });

    return {
        valid,
        strings,
        rows,
        cells,
        dimension: $.getAttribute($.findOne('dimension', sheet), 'ref'),
        hasFormula: Boolean($.findOne('f', sheet)),
    };
}
