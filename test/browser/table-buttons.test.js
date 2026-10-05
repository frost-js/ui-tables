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
        test('round-trips a large workbook and preserves date boundaries, percentages and blanks', async ({ page }) => {
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
            rows.push(['29/02/1900', '1900-03-01'], ['12.5%', '25%'], [null, ''], ['2024-02-30', '25:00:00']);

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
            expect(worksheet.rows.slice(0, 96)).toEqual(rows.slice(0, 96).map(([value, index]) => [value, String(index)]));
            expect(worksheet.rows[96]).toEqual(['60', '61']);
            expect(worksheet.rows[97]).toEqual(['0.125', '0.25']);
            expect(worksheet.rows[98]).toHaveLength(0);
            expect(worksheet.rows[99]).toEqual(['2024-02-30', '25:00:00']);
        });

        test('downloads valid XML with dates, zero, booleans, escaping, and wide columns', async ({ page }) => {
            await page.evaluate(() => {
                const values = [
                    0, false, true, 'A & B & C < D < E', 'Café 🌨️',
                    '2024-01-15', '2024-03-15 12:30:00', '12:30:00', '=1+1', 'x'.repeat(200),
                ];
                while (values.length < 28) {
                    values.push(`Column ${values.length + 1}`);
                }
                $.setHtml($.findOne('thead tr'), values.map((_, index) => `<th>Field ${index + 1}</th>`).join(''));
                UI.Table.init($.findOne('#table'), {
                    data: [values],
                    order: [],
                    buttons: [{ type: 'excel', title: 'Workbook' }],
                });
            });

            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Excel' }).click();
            const download = await pending;

            expect(download.suggestedFilename()).toBe('Workbook.xlsx');

            const files = readZip(await readDownload(download));

            const worksheet = await page.evaluate(readWorksheet, [...files]);

            expect(worksheet.valid).toBe(true);
            expect(worksheet.cells).toMatchObject({
                A2: { value: '0' },
                B2: { value: '0', type: 'b' },
                C2: { value: '1' },
                F2: { value: '45306' },
            });
            expect(Number(worksheet.cells.G2.value)).toBeCloseTo(45366 + 12.5 / 24, 8);
            expect(Number(worksheet.cells.H2.value)).toBeCloseTo(12.5 / 24, 8);
            expect(worksheet.dimension).toBe('A1:AB2');
            expect(worksheet.hasFormula).toBe(false);
            expect(worksheet.strings).toEqual(expect.arrayContaining(['A & B & C < D < E', 'Café 🌨️']));
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
