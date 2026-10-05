import { expect, test } from '#test';
import { readCsv, readDownload, readWorksheet, readZip } from '../support/exports.js';

test.describe('Table buttons', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body, '<table id="table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody></tbody></table>');
        });
    });

    test.describe('buttons option', () => {
        test('invokes custom buttons with the public component as receiver', async ({ page }) => {
            await page.evaluate(() => UI.Table.init($.findOne('#table'), {
                data: [['Alice', 10], ['Bob', 20], ['Charlie', 30]],
                buttons: [{
                    text: 'Inspect',
                    callback() {
                        $.setDataset(this.node, 'selectedValue', this.getValue(0, 0));
                    },
                }],
            }));

            await page.getByRole('button', { name: 'Inspect' }).click();

            await expect(page.locator('#table')).toHaveAttribute('data-selected-value', 'Alice');
        });
    });

    test.describe('csv', () => {
        for (const { name, visible, expected } of [
            { name: 'all columns', visible: true, expected: [['Name', 'Value'], ['Alice', '10'], ['Bob', '20'], ['Charlie', '30']] },
            { name: 'visible columns only', visible: false, expected: [['Name'], ['Alice'], ['Bob'], ['Charlie']] },
        ]) {
            test(`exports displayed rows with ${name}`, async ({ page }) => {
                await page.evaluate((visible) => UI.Table.init($.findOne('#table'), {
                    data: [['Alice', 10], ['Bob', 20], ['Charlie', 30]],
                    buttons: [{ type: 'csv', title: 'scores' }],
                    columns: [{}, { visible }],
                }), visible);

                const pending = page.waitForEvent('download');
                await page.getByRole('button', { name: 'CSV' }).click();
                const download = await pending;

                expect(download.suggestedFilename()).toBe('scores.csv');
                expect(readCsv((await readDownload(download)).toString())).toEqual(expected);
            });
        }

        test('round-trips punctuation, newlines, Unicode, and empty/false/zero values', async ({ page }) => {
            const rows = [['quote"only', 'line\nbreak'], ['comma,value', 'Café 🌨️'], [0, false], [null, '']];

            await page.evaluate((data) => UI.Table.init($.findOne('#table'), {
                data,
                order: [],
                buttons: [{ type: 'csv', title: 'Values' }],
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
                    $.setDataset(document.body, 'revoked', true);
                    original(url);
                };
                UI.Table.init($.findOne('#table'), {
                    data: [['A', 1], ['B', 2]],
                    length: 1,
                    buttons: [{ type: 'csv', columns: [1, 0] }],
                });
            });

            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'CSV' }).click();

            expect(readCsv((await readDownload(await pending)).toString())).toEqual([['Value', 'Name'], ['1', 'A']]);
            await expect(page.locator('body')).toHaveAttribute('data-revoked', 'true');
        });

        for (const { name, escapeFormulae, expected } of [
            { name: 'escapes formula text', escapeFormulae: true, expected: '\'=1+1' },
            { name: 'preserves formula text', escapeFormulae: false, expected: '=1+1' },
        ]) {
            test(name, async ({ page }) => {
                await page.evaluate((escapeFormulae) => UI.Table.init($.findOne('#table'), {
                    data: [['=1+1', -2]],
                    buttons: [{ type: 'csv', escapeFormulae }],
                }), escapeFormulae);

                const pending = page.waitForEvent('download');
                await page.getByRole('button', { name: 'CSV' }).click();
                const rows = readCsv((await readDownload(await pending)).toString());

                expect(rows[1][0]).toBe(expected);
                expect(rows[1][1]).toBe('-2');
            });
        }
    });

    test.describe('excel', () => {
        test('downloads and round-trips a large compressed workbook', async ({ page }) => {
            let seed = 123456;
            const rows = Array.from({ length: 96 }, (_, index) => {
                let text = `Record ${index}: `;

                // Seeded text is repeatable and exercises compressed payloads beyond 32 KB.
                for (let count = 0; count < 2048; count++) {
                    seed ^= seed << 13;
                    seed ^= seed >>> 17;
                    seed ^= seed << 5;
                    text += String.fromCharCode(65 + ((seed >>> 0) % 26));
                }

                return [text, index];
            });

            await page.evaluate((data) => UI.Table.init($.findOne('#table'), {
                data,
                order: [],
                paging: false,
                buttons: [{ type: 'excel' }],
            }), rows);

            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Excel', exact: true }).click();
            const files = readZip(await readDownload(await pending));

            const worksheet = await page.evaluate(readWorksheet, [...files]);

            expect(worksheet.valid).toBe(true);
            expect(files.get('xl/worksheets/sheet1.xml').method).toBe(8);
            expect(worksheet.rows).toEqual(rows.map(([value, index]) => [value, String(index)]));
        });

        test('downloads a named workbook with valid XML and columns beyond Z', async ({ page }) => {
            const values = Array.from({ length: 28 }, (_, index) => `Column ${index + 1}`);

            await page.evaluate((values) => {
                $.setHtml($.findOne('thead tr'), values.map((_, index) => `<th>Field ${index + 1}</th>`).join(''));
                UI.Table.init($.findOne('#table'), {
                    data: [values],
                    order: [],
                    buttons: [{ type: 'excel', title: 'Workbook' }],
                });
            }, values);

            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Excel' }).click();
            const download = await pending;

            expect(download.suggestedFilename()).toBe('Workbook.xlsx');

            const files = readZip(await readDownload(download));

            const worksheet = await page.evaluate(readWorksheet, [...files]);

            expect(worksheet.valid).toBe(true);
            expect(worksheet.dimension).toBe('A1:AB2');
            expect(worksheet.rows).toEqual([values]);
            expect(files.get('xl/styles.xml').text).toContain('cellXfs count="9"');
        });
    });

    test.describe('print', () => {
        test('creates a text title and waits for the print view before closing', async ({ page }) => {
            await page.evaluate(() => {
                const open = window.open.bind(window);
                window.open = (...args) => {
                    const popup = open(...args);
                    popup.print = () => {
                        const stylesReady = $.find('link[rel="stylesheet"]', popup.document)
                            .every((link) => link.sheet?.cssRules.length);

                        $.setDataset(popup.document.body, 'printed', 'true');
                        $.setDataset(popup.document.body, 'stylesReady', String(stylesReady));
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
                data: [['Alice', 1], [0, false]],
                order: [],
                buttons: [{ type: 'print', title: '<b>Literal title</b>' }],
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
