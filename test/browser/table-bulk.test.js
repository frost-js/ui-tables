import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table bulk data', () => {
    test.beforeEach(setupTable);

    test.describe('#addRows', () => {
        test('appends a large batch with one recalculation and draw while retaining the page', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable();

                table.page(2);

                let processing = 0;
                let draws = 0;

                $.addEvent('#table', 'processing.ui.table', () => processing++);
                $.addEvent('#table', 'draw.ui.table', () => draws++);

                const rows = Array.from({ length: 1000 }, (_, index) => [`New ${index}`, index]);

                table.addRows(rows);
                rows[0][0] = 'Changed';

                return {
                    processing,
                    draws,
                    info: table.info(),
                    first: table.getRow(4, { modified: false }),
                };
            });

            expect(result.processing).toBe(1);
            expect(result.draws).toBe(1);
            expect(result.info).toEqual({
                start: 2,
                end: 4,
                total: 1004,
                filtered: 1004,
            });
            expect(result.first).toEqual(['New 0', 0]);
        });

        test('retains search and filters while adding only matching rows to the view', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.search('A');
                table.setFilters([{ column: 1, operator: 'gte', value: 3 }]);
                table.addRows([['A', 5], ['A', 2], ['Other', 6]]);

                return {
                    rows: table.getData({ scope: 'filtered' }),
                    info: table.info(),
                };
            });

            expect(result.rows).toEqual([['A', 3], ['A', 5]]);
            expect(result.info).toEqual({
                start: 0,
                end: 2,
                total: 7,
                filtered: 2,
            });
            await expect(page.getByRole('searchbox')).toHaveValue('A');
        });

        test('does nothing for an empty batch', async ({ page }) => {
            const events = await page.evaluate(() => {
                const table = window.createTable();
                let events = 0;

                $.addEvent('#table', 'processing.ui.table draw.ui.table', () => events++);
                table.addRows([]);

                return events;
            });

            expect(events).toBe(0);
        });
    });

    test.describe('#getData', () => {
        test('reads all scopes in active order without changing the view or drawing', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.setFilters([{ column: 1, operator: 'gte', value: 2 }]);
                table.order([[1, 'desc']]);
                table.page(2);

                let events = 0;

                $.addEvent('#table', 'processing.ui.table draw.ui.table page.ui.table', () => events++);

                return {
                    page: table.getData(),
                    filtered: table.getData({ scope: 'filtered' }),
                    all: table.getData({ scope: 'all' }),
                    info: table.info(),
                    events,
                };
            });

            expect(result.page).toEqual([['B', 2]]);
            expect(result.filtered).toEqual([['C', 4], ['A', 3], ['B', 2]]);
            expect(result.all).toEqual([['C', 4], ['A', 3], ['B', 2], ['A', 1]]);
            expect(result.info).toEqual({
                start: 2,
                end: 3,
                total: 4,
                filtered: 3,
            });
            expect(result.events).toBe(0);
            await expect(page.locator('tbody td')).toHaveText(['B', '2']);
        });

        test('returns raw shallow row copies and preserves input order without sorting', async ({ page }) => {
            const result = await page.evaluate(() => {
                const nested = { active: true };
                const table = window.createTable({
                    data: [{ name: 'B', score: 2, nested }, { name: 'A', score: 1 }],
                    columns: [{ data: 'name', render: () => 'Display' }, { data: 'score' }],
                    order: [],
                });
                const rows = table.getData({ scope: 'all' });
                const shared = rows[0].nested === table.options.data[0].nested;

                rows[0].name = 'Changed';
                rows.pop();

                return {
                    names: table.getColumn('name'),
                    shared,
                };
            });

            expect(result.names).toEqual(['B', 'A']);
            expect(result.shared).toBe(true);
        });

        test('keeps the full filtered indexes current after single-row edits and clearing', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable();

                table.search('A');
                table.addRow(['A', 5]);
                table.setValue(1, 0, 'Other', { modified: false });
                table.removeRow(2, { modified: false });

                const edited = table.getData({ scope: 'filtered' });

                table.clear();

                return {
                    edited,
                    cleared: table.getData({ scope: 'filtered' }),
                };
            });

            expect(result.edited).toEqual([['A', 5]]);
            expect(result.cleared).toEqual([]);
        });

        test('rejects an unknown scope', async ({ page }) => {
            const error = await page.evaluate(() => {
                try {
                    window.createTable().getData({ scope: 'visible' });
                } catch (error) {
                    return error.name;
                }
            });

            expect(error).toBe('RangeError');
        });

        test('stops an all-scope read when a sort renderer disposes the table', async ({ page }) => {
            const rows = await page.evaluate(() => {
                let dispose = false;
                const table = window.createTable({
                    columns: [
                        {
                            render(value, { purpose }) {
                                if (dispose && purpose === 'sort') {
                                    this.dispose();
                                }

                                return value;
                            },
                        },
                        {},
                    ],
                });

                dispose = true;

                return table.getData({ scope: 'all' });
            });

            expect(rows).toEqual([]);
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
    });

    test.describe('#setData', () => {
        for (const { name, options, rows, start } of [
            { name: 'resets by default', options: {}, rows: [['X', 1], ['Y', 2], ['Z', 3]], start: 0 },
            {
                name: 'retains a valid page',
                options: { resetPage: false },
                rows: [['X', 1], ['Y', 2], ['Z', 3]],
                start: 2,
            },
            {
                name: 'clamps a retained page',
                options: { resetPage: false },
                rows: [['X', 1]],
                start: 0,
            },
        ]) {
            test(name, async ({ page }) => {
                const result = await page.evaluate(({ options, rows }) => {
                    const table = window.createTable();

                    table.page(2);

                    let draws = 0;

                    $.addEvent('#table', 'draw.ui.table', () => draws++);
                    table.setData(rows, options);

                    return {
                        start: table.info().start,
                        draws,
                        all: table.getData({ scope: 'all' }),
                    };
                }, { options, rows });

                expect(result.start).toEqual(start);
                expect(result.draws).toBe(1);
                expect(result.all).toEqual(rows);
            });
        }

        test('preserves search, filters, predicate, order, visibility, and page length', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.search('A');
                table.setFilters([{ column: 1, operator: 'gte', value: 3 }]);
                table.setRowFilter((row) => row[1] < 10);
                table.order([[1, 'desc']]);
                table.hideColumn(0);
                table.length(4);
                table.setData([['A', 8], ['A', 4], ['A', 12], ['A', 1], ['B', 7]]);
            });

            await expect(page.locator('thead th')).toHaveText(['Score']);
            await expect(page.locator('tbody td')).toHaveText(['8', '4']);
            await expect(page.getByRole('searchbox')).toHaveValue('A');
            await expect(page.getByRole('combobox')).toHaveValue('4');
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 2 (filtered from 5 total)');
        });

        test('replaces DOM metadata and retains filtering when replacing with no rows', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td data-search="alias">Old</td><td>1</td></tr>');

                const table = window.createTable({ data: null });

                table.search('alias');
                table.setData([]);

                const empty = table.getData({ scope: 'all' });

                table.setData([['Old', 2], ['alias', 3]]);

                return {
                    empty,
                    filtered: table.getData({ scope: 'filtered' }),
                };
            });

            expect(result.empty).toEqual([]);
            expect(result.filtered).toEqual([['alias', 3]]);
            await expect(page.getByRole('searchbox')).toHaveValue('alias');
        });
    });

    test.describe('batch validation and copying', () => {
        for (const method of ['addRows', 'setData']) {
            test(`${method} validates the complete batch before modifying rows`, async ({ page }) => {
                const result = await page.evaluate((method) => {
                    const table = window.createTable();

                    table.page(2);

                    const errors = [];

                    for (const rows of [null, [['Valid', 5], null], new Array(2)]) {
                        try {
                            table[method](rows);
                        } catch (error) {
                            errors.push(error.name);
                        }
                    }

                    return {
                        errors,
                        rows: table.getData(),
                        total: table.info().total,
                    };
                }, method);

                expect(result.errors).toEqual(['TypeError', 'TypeError', 'TypeError']);
                expect(result.rows).toEqual([['B', 2], ['C', 4]]);
                expect(result.total).toBe(4);
            });

            test(`${method} copies row containers while retaining nested references`, async ({ page }) => {
                const result = await page.evaluate((method) => {
                    const table = window.createTable({
                        data: [],
                        columns: [{ data: 'name' }, { data: 'score' }],
                    });
                    const nested = { value: 1 };
                    const rows = [{ name: 'Original', score: 3, nested }];

                    table[method](rows);
                    rows[0].name = 'Changed';
                    rows.push({ name: 'Extra', score: 4 });

                    const data = table.getData();

                    return {
                        name: data[0].name,
                        count: data.length,
                        shared: data[0].nested === nested,
                    };
                }, method);

                expect(result.name).toBe('Original');
                expect(result.count).toBe(1);
                expect(result.shared).toBe(true);
            });

            test(`${method} leaves rows intact when copying a later row throws`, async ({ page }) => {
                const result = await page.evaluate((method) => {
                    const table = window.createTable();

                    try {
                        table[method]([
                            ['Valid', 5],
                            {
                                get name() {
                                    throw new Error('Cannot copy row.');
                                },
                            },
                        ]);
                    } catch {
                        return table.getData({ scope: 'all' });
                    }
                }, method);

                expect(result).toEqual([['A', 1], ['A', 3], ['B', 2], ['C', 4]]);
            });
        }
    });

    test.describe('remote data', () => {
        test('permits page reads and rejects bulk updates and complete-dataset scopes', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                getResults: () => ({ results: [['Remote', 1]], total: 50, filtered: 50 }),
            }));

            await expect(page.locator('tbody td')).toHaveText(['Remote', '1']);

            const result = await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));
                const errors = [];

                for (const action of [
                    () => table.addRows([]),
                    () => table.setData([]),
                    () => table.getData({ scope: 'filtered' }),
                    () => table.getData({ scope: 'all' }),
                ]) {
                    try {
                        action();
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                const rows = table.getData();

                rows[0][0] = 'Changed';

                return {
                    errors,
                    rows: table.getData(),
                    total: table.info().total,
                };
            });

            expect(result.errors).toEqual(['TypeError', 'TypeError', 'RangeError', 'RangeError']);
            expect(result.rows).toEqual([['Remote', 1]]);
            expect(result.total).toBe(50);
        });
    });
});
