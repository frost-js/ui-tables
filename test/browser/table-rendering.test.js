import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table rendering', () => {
    test.beforeEach(setupTable);

    test.describe('callbacks', () => {
        test('passes the information text and heading row to callbacks', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                infoCallback: (start, end, total, filtered, text) => `${text} (${filtered} matches)`,
                headerCallback: (row) => $.setDataset(row, 'callback', 'heading'),
            }));

            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 4 (4 matches)');
            await expect(page.locator('#table thead tr')).toHaveAttribute('data-callback', 'heading');
        });

        test('passes the footer and callback indexes in draw order', async ({ page }) => {
            await page.evaluate(() => {
                $.append('#table', $.create('tfoot', {
                    html: '<tr><td colspan="2">Footer</td></tr>',
                }));
                window.calls = [];
                const record = (value) => window.calls.push(value);
                window.createTable({
                    preDrawCallback() {
                        record('pre');
                    },
                    headerCallback(head, data, start, end, indexes) {
                        window.range = [start, end, ...indexes];
                        record('header');
                    },
                    infoCallback(start, end, total, filtered, text) {
                        record('info');
                        return text;
                    },
                    rowCallback() {
                        record('row');
                    },
                    createdRow() {
                        record('created');
                    },
                    drawCallback() {
                        record('draw');
                    },
                    footerCallback(footer) {
                        record('footer');
                        $.setText($.findOne('td', footer), 'Updated footer');
                        this.dispose();
                    },
                });
            });

            expect(await page.evaluate(() => window.calls)).toEqual(['pre', 'header', 'info', 'row', 'created', 'row', 'created', 'draw', 'footer']);
            expect(await page.evaluate(() => window.range)).toEqual([0, 2, 1, 2]);
            await expect(page.locator('tfoot td')).toHaveText('Footer');
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });

        test('stops an obsolete draw when a callback changes the search', async ({ page }) => {
            await page.evaluate(() => {
                let first = true;
                window.createTable({
                    headerCallback() {
                        if (first) {
                            first = false;
                            this.search('B');
                        }
                    },
                });
            });

            await expect(page.locator('tbody td')).toHaveText(['B', '2']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
        });

        test('can cancel a draw and refresh it later', async ({ page }) => {
            await page.evaluate(() => {
                window.cancelDraw = true;
                window.createTable({ preDrawCallback: () => !window.cancelDraw });
            });

            await expect(page.locator('tbody tr')).toHaveCount(0);

            await page.evaluate(() => {
                window.cancelDraw = false;
                $('#table').table('refresh');
            });

            await expect(page.locator('tbody tr')).toHaveCount(2);
        });
    });

    test.describe('sanitization', () => {
        test('sanitizes formatted HTML and applies cell classes', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [['<strong>Safe</strong><img src=x onerror="window.bad=true">', 1]],
                columns: [{ class: 'cell-name', format: (value) => value }, {}],
            }));

            await expect(page.locator('td.cell-name strong')).toHaveText('Safe');
            await expect(page.locator('[onerror]')).toHaveCount(0);
            expect(await page.evaluate(() => window.bad)).toBeUndefined();
        });
    });

    test.describe('layout option', () => {
        test('supports a custom layout with the public component as receiver', async ({ page }) => {
            await page.evaluate(() => {
                UI.Table.layout.summary = function(container) {
                    $.setText(container, $.getProperty(this.node, 'id'));
                    $.setDataset(container, 'testSummary', '');
                };
                window.createTable({ layout: { top: 'summary' } });
            });

            await expect(page.locator('[data-test-summary]')).toHaveText('table');
            await expect(page.getByRole('searchbox')).toHaveCount(0);
            await expect(page.getByRole('status')).toBeVisible();
        });
    });

    test.describe('disposal during callbacks', () => {
        for (const callback of ['preDrawCallback', 'headerCallback', 'infoCallback', 'rowCallback', 'createdRow', 'drawCallback']) {
            test(`allows disposal during ${callback}`, async ({ page }) => {
                await page.evaluate((callback) => window.createTable({
                    [callback]() {
                        this.dispose();
                    },
                }), callback);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }

        for (const callback of ['format', 'createdCell']) {
            test(`allows disposal during column ${callback}`, async ({ page }) => {
                await page.evaluate((callback) => window.createTable({
                    columns: [{
                        [callback]() {
                            this.dispose();
                        },
                    }, {}],
                }), callback);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }

        test('allows disposal during sanitization', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                sanitize(html) {
                    $.getData('#table', 'table').dispose();
                    return html;
                },
            }));

            await expect(page.locator('.table-responsive')).toHaveCount(0);
            await expect(page.locator('caption')).toHaveText('Scores');
        });

        test('allows disposal during custom layout rendering', async ({ page }) => {
            await page.evaluate(() => {
                UI.Table.layout.stop = function() {
                    this.dispose();
                };
                window.createTable({ layout: { top: 'stop' } });
            });

            await expect(page.locator('.table-responsive')).toHaveCount(0);
            await expect(page.locator('caption')).toHaveText('Scores');
        });
    });
});
