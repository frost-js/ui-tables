import { expect, test } from '@playwright/test';
import Workbook from '../../src/js/workbook/workbook.js';
import { readZip } from '../support/exports.js';

test.describe('Workbook', () => {
    test.describe('numeric cells', () => {
        for (const { name, value, expected, type = null, style = null } of [
            { name: 'zero', value: 0, expected: 0 },
            { name: 'false', value: false, expected: 0, type: 'b' },
            { name: 'true', value: true, expected: 1, type: 'b' },
            { name: 'a decimal percentage', value: '12.5%', expected: 0.125, style: '3' },
            { name: 'an integer percentage', value: '25%', expected: 0.25, style: '2' },
            { name: 'Excel day 60', value: '29/02/1900', expected: 60, style: '4' },
            { name: 'the day after Excel day 60', value: '1900-03-01', expected: 61, style: '4' },
            { name: 'an ISO date', value: '2024-01-15', expected: 45306, style: '4' },
            { name: 'a date and time', value: '2024-03-15 12:30:00', expected: 45366 + 12.5 / 24, style: '6' },
            { name: 'a time', value: '12:30:00', expected: 12.5 / 24, style: '5' },
        ]) {
            test(`serializes ${name} with its spreadsheet type and format`, async () => {
                const workbook = new Workbook();
                workbook.addSheet({ rows: [[value]] });

                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const sheet = files.get('xl/worksheets/sheet1.xml').text;
                const cell = sheet.match(/<c\b([^>]*)><v>([^<]+)<\/v><\/c>/);

                expect(cell).not.toBeNull();
                expect(Number(cell[2])).toBeCloseTo(expected, 8);
                expect(cell[1].match(/\bt="([^"]+)"/)?.[1] ?? null).toBe(type);
                expect(cell[1].match(/\bs="([^"]+)"/)?.[1] ?? null).toBe(style);
            });
        }
    });

    test.describe('shared strings', () => {
        for (const { name, value, encoded } of [
            { name: 'XML punctuation', value: 'A & B & C < D < E', encoded: 'A &amp; B &amp; C &lt; D &lt; E' },
            { name: 'Unicode', value: 'Café 🌨️', encoded: 'Café 🌨️' },
            { name: 'an invalid date', value: '2024-02-30', encoded: '2024-02-30' },
            { name: 'an invalid time', value: '25:00:00', encoded: '25:00:00' },
            { name: 'formula-like text', value: '=1+1', encoded: '=1+1' },
            { name: 'replacement tokens', value: '$$ $& $` $\'', encoded: '$$ $&amp; $` $&apos;' },
        ]) {
            test(`preserves ${name} as text`, async () => {
                const workbook = new Workbook();
                workbook.addSheet({ rows: [[value]] });

                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const sheet = files.get('xl/worksheets/sheet1.xml').text;
                const strings = files.get('xl/sharedStrings.xml').text;

                expect(sheet).toContain('t="s"');
                expect(sheet).toContain('<v>0</v>');
                expect(sheet).not.toMatch(/<f\b/);
                expect(strings).toContain(`<t xml:space="preserve">${encoded}</t>`);
            });
        }
    });

    test.describe('inline strings', () => {
        for (const { name, value, encoded } of [
            { name: 'long text', value: 'x'.repeat(200), encoded: 'x'.repeat(200) },
            { name: 'long XML punctuation', value: 'A & < B > C'.repeat(20), encoded: 'A &amp; &lt; B &gt; C'.repeat(20) },
            { name: 'long replacement tokens', value: '$$ $& $` $\''.repeat(20), encoded: '$$ $&amp; $` $&apos;'.repeat(20) },
        ]) {
            test(`stores ${name} inline`, async () => {
                const workbook = new Workbook();
                workbook.addSheet({ rows: [[value]] });

                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const sheet = files.get('xl/worksheets/sheet1.xml').text;

                expect(sheet).toContain('t="inlineStr"');
                expect(sheet).toContain(`<is><t xml:space="preserve">${encoded}</t></is>`);
                expect(files.get('xl/sharedStrings.xml').text).toContain('count="0" uniqueCount="0"');
            });
        }
    });

    test.describe('blank cells', () => {
        for (const { name, value } of [
            { name: 'null', value: null },
            { name: 'undefined', value: undefined },
            { name: 'an empty string', value: '' },
        ]) {
            test(`omits ${name} without removing the row`, async () => {
                const workbook = new Workbook();
                workbook.addSheet({ rows: [[value]] });

                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const sheet = files.get('xl/worksheets/sheet1.xml').text;

                expect(sheet).toContain('<row r="1"></row>');
                expect(sheet).not.toMatch(/<c\b/);
            });
        }
    });

    test.describe('archive creation', () => {
        test('preserves replacement tokens in sheet names', async () => {
            const workbook = new Workbook();
            workbook.addSheet({ rows: [['Value']] }, '$$ $& $` $\' name');

            const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
            const xml = files.get('xl/workbook.xml').text;
            const names = [...xml.matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);

            expect(names).toEqual(['$$ $&amp; $` $&apos; name']);
        });

        test('escapes duplicate sheet names and recreates the archive without stale strings', async () => {
            const workbook = new Workbook();
            workbook.addSheet({ rows: [['first', 'first']] }, 'A & "B"');
            workbook.addSheet({ rows: [['second']] }, 'A & "B"');

            // Reusing the same instance checks that shared strings reset between archives.
            for (let index = 0; index < 2; index++) {
                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const xml = files.get('xl/workbook.xml').text;
                const names = [...xml.matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);

                expect(names).toEqual(['A &amp; &quot;B&quot;', 'A &amp; &quot;B&quot; (1)']);
                expect(files.get('xl/sharedStrings.xml').text).toContain('count="3" uniqueCount="2"');
                expect(files.has('xl/worksheets/sheet2.xml')).toBe(true);
            }
        });
    });
});
