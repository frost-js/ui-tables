import { expect, test } from '#test';
import Workbook from '../../src/js/workbook/workbook.js';
import Zip from '../../src/js/zip/zip.js';
import { readCsv, readDownload, readZip } from '../support/exports.js';

test.describe('Table buttons', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body, '<table id="table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody></tbody></table>');
        });
    });

    test.describe('csv', () => {
        test('round-trips punctuation, newlines, Unicode, and empty/false/zero values', async ({ page }) => {
            const rows = [['quote"only', 'line\nbreak'], ['comma,value', 'Café 🌨️'], [0, false], [null, '']];
            await page.evaluate((data) => UI.Table.init($.findOne('#table'), {
                data, order: [], buttons: [{ type: 'csv', title: 'Values' }],
            }), rows);
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'CSV' }).click();
            const download = await pending;
            expect(download.suggestedFilename()).toBe('Values.csv');
            expect(readCsv((await readDownload(download)).toString())).toEqual([
                ['Name', 'Value'], ['quote"only', 'line\nbreak'], ['comma,value', 'Café 🌨️'], ['0', 'false'], ['', ''],
            ]);
        });
        test('exports current results in the requested column order and revokes the URL', async ({ page }) => {
            await page.evaluate(() => {
                const original = URL.revokeObjectURL;
                URL.revokeObjectURL = (url) => {
                    $.setDataset(document.body, 'revoked', true); original(url);
                };
                UI.Table.init($.findOne('#table'), { data: [['A', 1], ['B', 2]], length: 1,
                    buttons: [{ type: 'csv', columns: [1, 0] }] });
            });
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'CSV' }).click();
            expect(readCsv((await readDownload(await pending)).toString())).toEqual([['Value', 'Name'], ['1', 'A']]);
            await expect(page.locator('body')).toHaveAttribute('data-revoked', 'true');
        });
        for (const escapeFormulae of [true, false]) {
            test(`honors the formula escape option (${escapeFormulae})`, async ({ page }) => {
                await page.evaluate((escapeFormulae) => UI.Table.init($.findOne('#table'), {
                    data: [['=1+1', -2]], buttons: [{ type: 'csv', escapeFormulae }],
                }), escapeFormulae);
                const pending = page.waitForEvent('download');
                await page.getByRole('button', { name: 'CSV' }).click();
                const rows = readCsv((await readDownload(await pending)).toString());
                expect(rows[1][0]).toBe(escapeFormulae ? '\'=1+1' : '=1+1');
                expect(rows[1][1]).toBe('-2');
            });
        }
    });

    test.describe('excel', () => {
        test('round-trips a large workbook and preserves date boundaries, percentages and blanks', async ({ page }) => {
            const rows = await page.evaluate(() => {
                let seed = 123456;
                const rows = Array.from({ length: 96 }, (_, index) => {
                    let text = `Record ${index}: `;
                    for (let count = 0; count < 2048; count++) {
                        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
                        text += String.fromCharCode(65 + ((seed >>> 0) % 26));
                    }
                    return [text, index];
                });
                rows.push(['29/02/1900', '1900-03-01'], ['12.5%', '25%'], [null, ''], ['2024-02-30', '25:00:00']);
                UI.Table.init($.findOne('#table'), { data: rows, order: [], paging: false, buttons: [{ type: 'excel' }] });
                return rows;
            });
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Excel', exact: true }).click();
            const files = readZip(await readDownload(await pending));
            const values = await page.evaluate((entries) => {
                const xml = Object.fromEntries(entries.map(([name, value]) => [name, new DOMParser().parseFromString(value.text, 'application/xml')]));
                const strings = $.find('si', xml['xl/sharedStrings.xml']).map((item) => $.getText(item));
                return $.find('row', xml['xl/worksheets/sheet1.xml']).slice(1).map((row) => {
                    return $.find('c', row).map((cell) => {
                        const type = $.getAttribute(cell, 't');
                        const text = $.getText(cell);
                        return type === 's' ? strings[Number(text)] : text;
                    });
                });
            }, [...files]);
            expect(values.slice(0, 96)).toEqual(rows.slice(0, 96).map(([value, index]) => [value, String(index)]));
            expect(values[96]).toEqual(['60', '61']);
            expect(values[97]).toEqual(['0.125', '0.25']);
            expect(values[98]).toHaveLength(0);
            expect(values[99]).toEqual(['2024-02-30', '25:00:00']);
        });
        test('downloads valid XML with dates, zero, booleans, escaping, and wide columns', async ({ page }) => {
            await page.evaluate(() => {
                const values = [0, false, true, 'A & B & C < D < E', 'Café 🌨️', '2024-01-15', '2024-03-15 12:30:00', '12:30:00', '=1+1', 'x'.repeat(200)];
                while (values.length < 28) {
                    values.push(`Column ${values.length + 1}`);
                }
                $.setHtml($.findOne('thead tr'), values.map((_, index) => `<th>Field ${index + 1}</th>`).join(''));
                UI.Table.init($.findOne('#table'), { data: [values], order: [], buttons: [{ type: 'excel', title: 'Workbook' }] });
            });
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Excel' }).click();
            const download = await pending;
            expect(download.suggestedFilename()).toBe('Workbook.xlsx');
            const files = readZip(await readDownload(download));
            await page.evaluate((entries) => {
                window.xml = Object.fromEntries(entries.map(([name, value]) => [name, new DOMParser().parseFromString(value.text, 'application/xml')]));
            }, [...files]);
            expect(await page.evaluate(() => Object.values(window.xml).some((doc) => doc.querySelector('parsererror')))).toBe(false);
            const cell = async (reference) => page.evaluate((reference) => $.getText($.findOne(`c[r="${reference}"] v`, window.xml['xl/worksheets/sheet1.xml'])), reference);
            expect(await cell('A2')).toBe('0');
            expect(await cell('B2')).toBe('0');
            expect(await cell('C2')).toBe('1');
            expect(await cell('F2')).toBe('45306');
            expect(Number(await cell('G2'))).toBeCloseTo(45366 + 12.5 / 24, 8);
            expect(Number(await cell('H2'))).toBeCloseTo(12.5 / 24, 8);
            expect(await page.evaluate(() => $.getAttribute($.findOne('dimension', window.xml['xl/worksheets/sheet1.xml']), 'ref'))).toBe('A1:AB2');
            expect(await page.evaluate(() => $.getAttribute($.findOne('c[r="B2"]', window.xml['xl/worksheets/sheet1.xml']), 't'))).toBe('b');
            expect(await page.evaluate(() => $.findOne('f', window.xml['xl/worksheets/sheet1.xml']))).toBeNull();
            const strings = await page.evaluate(() => $.getText(window.xml['xl/sharedStrings.xml'].documentElement));
            expect(strings).toContain('A & B & C < D < E');
            expect(strings).toContain('Café 🌨️');
            expect(files.get('xl/styles.xml').text).toContain('cellXfs count="9"');
        });
        test('supports multiple escaped sheet names and repeat creation without stale strings', async ({ page }) => {
            const workbook = new Workbook();
            workbook.addSheet({ rows: [['first', 'first']] }, 'A & "B"');
            workbook.addSheet({ rows: [['second']] }, 'A & "B"');
            for (let index = 0; index < 2; index++) {
                const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
                const names = await page.evaluate((xml) => {
                    const doc = new DOMParser().parseFromString(xml, 'application/xml');
                    return $.find('sheet', doc).map((sheet) => $.getAttribute(sheet, 'name'));
                }, files.get('xl/workbook.xml').text);
                expect(names).toEqual(['A & "B"', 'A & "B" (1)']);
                expect(files.get('xl/sharedStrings.xml').text).toContain('count="3" uniqueCount="2"');
                expect(files.has('xl/worksheets/sheet2.xml')).toBe(true);
            }
        });
        test('encodes valid stored/compressed ZIP entries with UTF-8 names and DOS dates', async () => {
            const zip = new Zip();
            zip.addFile('café.txt', '123456789');
            zip.addFile('compressed.txt', 'abcdefghijklmnopqrstuvwxyz'.repeat(3000));
            const files = readZip(new Uint8Array(await zip.zip().arrayBuffer()));
            expect(files.get('café.txt').text).toBe('123456789');
            expect(files.get('café.txt').flags & 0x0800).toBe(0x0800);
            expect(files.get('café.txt').method).toBe(0);
            expect(files.get('compressed.txt').method).toBe(8);
            expect(files.get('compressed.txt').text).toBe('abcdefghijklmnopqrstuvwxyz'.repeat(3000));
            expect((files.get('café.txt').date >> 9) + 1980).toBe(new Date().getFullYear());
        });
    });

    test.describe('print', () => {
        test('creates a text title and waits for the print view before closing', async ({ page }) => {
            await page.evaluate(() => {
                const open = window.open.bind(window);
                window.open = (...args) => {
                    const popup = open(...args);
                    popup.print = () => {
                        $.setDataset(popup.document.body, 'printed', 'true');
                        $.setDataset(popup.document.body, 'stylesReady', String($.find('link[rel="stylesheet"]', popup.document).every((link) => link.sheet?.cssRules.length)));
                        $.setDataset(popup.document.body, 'fonts', popup.document.fonts.status);
                    };
                    popup.close = () => {
                        $.setDataset(popup.document.body, 'closed', 'true');
                    };
                    return popup;
                };
                $.setProperty($.findOne('#table'), 'dir', 'rtl');
            });
            await page.evaluate(() => UI.Table.init($.findOne('#table'), {
                data: [['Alice', 1], [0, false]], order: [], buttons: [{ type: 'print', title: '<b>Literal title</b>' }],
            }));
            const pending = page.waitForEvent('popup');
            await page.getByRole('button', { name: 'Print' }).click();
            const popup = await pending;
            await expect(popup.getByRole('heading')).toHaveText('<b>Literal title</b>');
            await expect(popup.locator('h1 b')).toHaveCount(0);
            await expect(popup.locator('tbody td')).toHaveText(['Alice', '1', '0', 'false']);
            await expect(popup.locator('body')).toHaveAttribute('data-printed', 'true');
            await expect(popup.locator('body')).toHaveAttribute('data-styles-ready', 'true');
            await expect(popup.locator('body')).toHaveAttribute('data-fonts', 'loaded');
            await expect(popup.locator('link[rel="stylesheet"]')).toHaveCount(2);
            await expect(popup.locator('body')).toHaveAttribute('data-closed', 'true');
            await expect(popup.locator('table')).toHaveCSS('direction', 'rtl');
            await popup.close();
        });
        test('handles a blocked popup', async ({ page }) => {
            await page.evaluate(() => {
                window.open = () => null;
                UI.Table.init($.findOne('#table'), { buttons: [{ type: 'print' }] });
            });
            await page.getByRole('button', { name: 'Print' }).click();
            await expect(page.locator('#table')).toBeVisible();
        });
    });
});
