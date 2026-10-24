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

    test.describe('export scopes', () => {
        for (const { type, label } of [{ type: 'csv', label: 'CSV' }, { type: 'excel', label: 'Excel' }]) {
            for (const { scope, expected } of [
                { scope: 'page', expected: [['B', '2']] },
                { scope: 'filtered', expected: [['C', '4'], ['A', '3'], ['B', '2']] },
                { scope: 'all', expected: [['C', '4'], ['A', '3'], ['B', '2'], ['A', '1']] },
            ]) {
                test(`${type} exports the ${scope} scope without changing the page`, async ({ page }) => {
                    await page.evaluate(({ type, scope }) => {
                        const table = UI.Table.init($.findOne('#table'), {
                            data: [['B', 2], ['A', 1], ['A', 3], ['C', 4]],
                            columns: [{}, { type: 'number' }],
                            order: [[1, 'desc']],
                            length: 2,
                            buttons: [{ type, scope }],
                        });

                        table.setFilters([{ column: 1, operator: 'gte', value: 2 }]);
                        table.page(2);
                    }, { type, scope });

                    const pending = page.waitForEvent('download');

                    await page.getByRole('button', { name: label, exact: true }).click();

                    const data = await readDownload(await pending);
                    const rows = type === 'csv' ?
                        readCsv(data.toString()).slice(1) :
                        (await page.evaluate(readWorksheet, [...readZip(data)])).rows;

                    expect(rows).toEqual(expected);
                    await expect(page.locator('tbody td')).toHaveText(['B', '2']);
                    await expect(page.getByRole('status')).toHaveText('Showing results 3 to 3 of 3 (filtered from 4 total)');
                });
            }
        }
    });

    test.describe('csv', () => {
        test('exports resolved values with formula escaping and preserves zero and false', async ({ page }) => {
            await page.evaluate(() => UI.Table.init($.findOne('#table'), {
                data: [['Alice', 0], ['Bob', false]],
                columns: [
                    {
                        render(value, { purpose, rowIndex }) {
                            return purpose === 'export' ? `=${value}:${rowIndex}` : value;
                        },
                    },
                    { format: () => 'Display only' },
                ],
                buttons: [{ type: 'csv', scope: 'all' }],
                length: 1,
                order: [[0, 'desc']],
            }));

            const pending = page.waitForEvent('download');

            await page.getByRole('button', { name: 'CSV' }).click();

            const rows = readCsv((await readDownload(await pending)).toString());

            expect(rows).toEqual([['Name', 'Value'], ['\'=Bob:1', 'false'], ['\'=Alice:0', '0']]);
        });

        test('exports DOM text and explicit empty attributes without markup', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td><strong>Alice &amp; Co</strong></td><td data-export=""><em>Hidden</em></td></tr>' +
                    '<tr><td data-export="Robert"><b>Bob</b></td><td>2</td></tr>');
                UI.Table.init($.findOne('#table'), { buttons: [{ type: 'csv' }] });
            });

            const pending = page.waitForEvent('download');

            await page.getByRole('button', { name: 'CSV' }).click();

            const rows = readCsv((await readDownload(await pending)).toString());

            expect(rows).toEqual([['Name', 'Value'], ['Alice & Co', ''], ['Robert', '2']]);
        });

        for (const { name, visible, expected } of [
            {
                name: 'all columns',
                visible: true,
                expected: [['Name', 'Value'], ['Alice', '10'], ['Bob', '20'], ['Charlie', '30']],
            },
            {
                name: 'visible columns only',
                visible: false,
                expected: [['Name'], ['Alice'], ['Bob'], ['Charlie']],
            },
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
                ['Name', 'Value'],
                ['quote"only', 'line\nbreak'],
                ['comma,value', 'Café 🌨️'],
                ['0', 'false'],
                ['', ''],
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
        test('exports renderer values instead of display markup', async ({ page }) => {
            await page.evaluate(() => UI.Table.init($.findOne('#table'), {
                data: [['Alice', { amount: 0 }], ['Bob', { amount: false }]],
                columns: [
                    {},
                    {
                        render: (value, { purpose }) => purpose === 'display' ? '<strong>Formatted</strong>' : value.amount,
                    },
                ],
                buttons: [{ type: 'excel', scope: 'filtered' }],
                length: 1,
            }));

            const pending = page.waitForEvent('download');

            await page.getByRole('button', { name: 'Excel' }).click();

            const files = readZip(await readDownload(await pending));
            const worksheet = await page.evaluate(readWorksheet, [...files]);

            expect(worksheet.valid).toBe(true);
            expect(worksheet.rows).toEqual([['Alice', '0'], ['Bob', 'false']]);
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
                columns: [
                    {
                        render: (value, { purpose }) => purpose === 'export' && value === 'Alice' ? 'Export Alice' : value,
                    },
                    {},
                ],
                order: [],
                buttons: [{ type: 'print', scope: 'all', title: '<b>Literal title</b>' }],
                length: 1,
            }));

            const pending = page.waitForEvent('popup');

            await page.getByRole('button', { name: 'Print' }).click();

            const popup = await pending;

            await expect(popup.getByRole('heading')).toHaveText('<b>Literal title</b>');
            await expect(popup.locator('h1 b')).toHaveCount(0);
            await expect(popup.locator('tbody td')).toHaveText(['Export Alice', '1', '0', 'false']);
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

    test.describe('interrupted exports', () => {
        for (const type of ['csv', 'excel', 'print']) {
            test(`does not open or download ${type} after renderer disposal`, async ({ page }) => {
                const calls = await page.evaluate((type) => {
                    let calls = 0;

                    URL.createObjectURL = () => {
                        calls++;
                    };
                    window.open = () => {
                        calls++;
                    };

                    const table = UI.Table.init($.findOne('#table'), {
                        data: [['Alice', 1]],
                        columns: [
                            {
                                render(value, { purpose }) {
                                    if (purpose === 'export') {
                                        this.dispose();
                                    }

                                    return value;
                                },
                            },
                            {},
                        ],
                    });

                    UI.Table.buttons[type].call(table, {});

                    return calls;
                }, type);

                expect(calls).toBe(0);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }
    });
});
