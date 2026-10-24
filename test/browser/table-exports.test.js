import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table export data', () => {
    test.beforeEach(setupTable);

    test.describe('#getExportData', () => {
        test('selects ordered scopes without changing the current view', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.setFilters([{ column: 1, operator: 'gte', value: 2 }]);
                table.order([[1, 'desc']]);
                table.page(2);

                let events = 0;

                $.addEvent('#table', 'draw.ui.table processing.ui.table page.ui.table', () => events++);

                return {
                    page: table.getExportData(),
                    filtered: table.getExportData({ scope: 'filtered' }),
                    all: table.getExportData({ scope: 'all' }),
                    info: table.info(),
                    events,
                };
            });

            expect(result.page).toEqual({
                headings: ['Name', 'Score'],
                rows: [['B', 2]],
            });
            expect(result.filtered).toEqual({
                headings: ['Name', 'Score'],
                rows: [['C', 4], ['A', 3], ['B', 2]],
            });
            expect(result.all).toEqual({
                headings: ['Name', 'Score'],
                rows: [['C', 4], ['A', 3], ['B', 2], ['A', 1]],
            });
            expect(result.info).toEqual({
                start: 2,
                end: 3,
                total: 4,
                filtered: 3,
            });
            expect(result.events).toBe(0);
            await expect(page.locator('tbody td')).toHaveText(['B', '2']);
        });

        test('collects all matches across pages using every active filter', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    data: Array.from({ length: 50 }, (_, index) => [index < 45 ? 'Café' : 'Other', index]),
                    columns: [{}, { type: 'number' }],
                    length: 5,
                    order: [[1, 'desc']],
                });

                table.search('café');
                table.setFilters([{ column: 1, operator: 'gte', value: 3 }]);
                table.setRowFilter((row) => row[1] < 40);
                table.page(2);

                return {
                    data: table.getExportData({ scope: 'filtered' }),
                    info: table.info(),
                };
            });

            expect(result.data.rows).toEqual(Array.from({ length: 37 }, (_, index) => ['Café', 39 - index]));
            expect(result.info).toEqual({
                start: 5,
                end: 10,
                filtered: 37,
                total: 50,
            });
            await expect(page.getByRole('searchbox')).toHaveValue('café');
        });

        test('resolves export values and original row indexes for reordered hidden columns', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.setHtml('thead th:first-child', '<strong>Name &amp; team</strong>');

                const table = window.createTable({
                    data: [['Café', '02'], ['Zero', 0], ['False', false]],
                    columns: [
                        {
                            render: (value, { purpose, rowIndex }) => purpose === 'export' ? `${value}:${rowIndex}` : value,
                        },
                        { type: 'number', visible: false },
                    ],
                    order: [[1, 'asc']],
                });

                return {
                    visible: table.getExportData({ scope: 'all' }),
                    selected: table.getExportData({ scope: 'all', columns: [1, 0] }),
                };
            });

            expect(result.visible).toEqual({
                headings: ['Name & team'],
                rows: [['Zero:1'], ['Café:0'], ['False:2']],
            });
            expect(result.selected).toEqual({
                headings: ['Score', 'Name & team'],
                rows: [[0, 'Zero:1'], ['02', 'Café:0'], [false, 'False:2']],
            });
            await expect(page.locator('thead th')).toHaveCount(1);
        });

        test('returns independent arrays and preserves DOM export text across pages', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td><strong>Alice &amp; Co</strong></td><td>1</td></tr>' +
                    '<tr><td data-export="Robert"><em>Bob</em></td><td data-export="">2</td></tr>');

                const table = window.createTable({
                    data: null,
                    length: 1,
                });
                const data = table.getExportData({ scope: 'all' });

                data.headings[0] = 'Changed';
                data.rows[0][0] = 'Changed';
                data.rows.pop();

                return table.getExportData({ scope: 'all' });
            });

            expect(result).toEqual({
                headings: ['Name', 'Score'],
                rows: [['Alice & Co', '1'], ['Robert', '']],
            });
        });

        test('retains input order without sorting and returns headings for no matches', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ order: [] });

                table.search('Missing');

                return {
                    all: table.getExportData({ scope: 'all' }),
                    filtered: table.getExportData({ scope: 'filtered' }),
                    emptyColumns: table.getExportData({ scope: 'all', columns: [] }),
                };
            });

            expect(result.all).toEqual({
                headings: ['Name', 'Score'],
                rows: [['B', 2], ['A', 1], ['A', 3], ['C', 4]],
            });
            expect(result.filtered).toEqual({
                headings: ['Name', 'Score'],
                rows: [],
            });
            expect(result.emptyColumns).toEqual({
                headings: [],
                rows: [[], [], [], []],
            });
        });

        for (const { options, error } of [
            { options: { scope: 'visible' }, error: 'RangeError' },
            { options: { columns: '0' }, error: 'TypeError' },
            { options: { columns: [0, 2] }, error: 'RangeError' },
        ]) {
            test(`rejects invalid options ${JSON.stringify(options)}`, async ({ page }) => {
                const result = await page.evaluate((options) => {
                    try {
                        window.createTable().getExportData(options);
                    } catch (error) {
                        return error.name;
                    }
                }, options);

                expect(result).toBe(error);
            });
        }
    });

    test.describe('interrupted collection', () => {
        for (const purpose of ['sort', 'export']) {
            test(`returns null after disposal during ${purpose}`, async ({ page }) => {
                const result = await page.evaluate((purpose) => {
                    let armed = false;
                    const table = window.createTable({
                        columns: [
                            {
                                render(value, context) {
                                    if (armed && context.purpose === purpose) {
                                        this.dispose();
                                    }

                                    return value;
                                },
                            },
                            {},
                        ],
                    });

                    armed = true;

                    return table.getExportData({ scope: 'all' });
                }, purpose);

                expect(result).toBeNull();
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('discards partial data when an export renderer replaces the dataset', async ({ page }) => {
            const result = await page.evaluate(() => {
                let replaced = false;
                const table = window.createTable({
                    columns: [
                        {
                            render(value, { purpose }) {
                                if (purpose === 'export' && !replaced) {
                                    replaced = true;
                                    this.setData([['Newest', 9]]);
                                }

                                return value;
                            },
                        },
                        {},
                    ],
                });

                return table.getExportData({ scope: 'filtered' });
            });

            expect(result).toBeNull();
            await expect(page.locator('tbody td')).toHaveText(['Newest', '9']);
        });
    });

    test.describe('remote collection', () => {
        test('exports the loaded page and rejects complete-dataset scopes before downloading', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                getResults: () => ({ results: [['Remote', 1]], total: 50, filtered: 50 }),
            }));

            await expect(page.locator('tbody td')).toHaveText(['Remote', '1']);

            const result = await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));
                const errors = [];
                let calls = 0;

                URL.createObjectURL = () => calls++;
                window.open = () => calls++;

                for (const scope of ['filtered', 'all']) {
                    for (const type of ['csv', 'excel', 'print']) {
                        try {
                            UI.Table.buttons[type].call(table, { scope });
                        } catch (error) {
                            errors.push({ name: `${type} (${scope})`, error: error.name });
                        }
                    }
                }

                return {
                    data: table.getExportData(),
                    errors,
                    calls,
                };
            });

            expect(result.data).toEqual({
                headings: ['Name', 'Score'],
                rows: [['Remote', 1]],
            });
            expect(result.errors).toEqual([
                { name: 'csv (filtered)', error: 'RangeError' },
                { name: 'excel (filtered)', error: 'RangeError' },
                { name: 'print (filtered)', error: 'RangeError' },
                { name: 'csv (all)', error: 'RangeError' },
                { name: 'excel (all)', error: 'RangeError' },
                { name: 'print (all)', error: 'RangeError' },
            ]);
            expect(result.calls).toBe(0);
        });
    });
});
