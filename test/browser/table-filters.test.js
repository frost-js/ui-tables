import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table filters', () => {
    test.beforeEach(setupTable);

    test.describe('#setFilters', () => {
        test('combines column filters and search, resetting the page with one draw', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.page(2);
                window.draws = 0;
                $.addEvent('#table', 'draw.ui.table', () => window.draws++);
                table.setFilters([
                    { column: 0, operator: 'equals', value: 'a' },
                    { column: 1, operator: 'gte', value: 2 },
                ]);
            });

            await expect(page.locator('tbody td')).toHaveText(['A', '3']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
            expect(await page.evaluate(() => window.draws)).toBe(1);

            await page.evaluate(() => $('#table').table('search', '1'));

            await expect(page.locator('tbody td')).toHaveText('No results to show');

            await page.evaluate(() => $('#table').table('setFilters', []));

            await expect(page.locator('tbody td')).toHaveText(['A', '1']);
            await expect(page.getByRole('searchbox')).toHaveValue('1');
        });

        for (const { operator, value, expected } of [
            { operator: 'contains', value: '2', expected: [2] },
            { operator: 'equals', value: '2', expected: [2] },
            { operator: 'gt', value: 2, expected: [3, 4] },
            { operator: 'gte', value: 2, expected: [2, 3, 4] },
            { operator: 'lt', value: 3, expected: [1, 2] },
            { operator: 'lte', value: 3, expected: [1, 2, 3] },
            { operator: 'between', value: [2, 3], expected: [2, 3] },
        ]) {
            test(`applies ${operator} to resolved numeric values`, async ({ page }) => {
                await page.evaluate(({ operator, value }) => {
                    const table = window.createTable({
                        columns: [{}, { type: 'number', render: (value) => String(value) }],
                        order: [[1, 'asc']],
                        paging: false,
                    });

                    table.setFilters([{ column: 1, operator, value }]);
                }, { operator, value });

                await expect(page.locator('tbody td:last-child')).toHaveText(expected.map(String));
            });
        }

        test('filters inclusive dates and excludes missing or invalid typed values', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({
                    data: [
                        ['Start', '2026-01-01'],
                        ['End', '2026-01-31'],
                        ['Outside', '2026-02-01'],
                        ['Invalid', '2026-02-30'],
                        ['Missing', null],
                        ['Blank', ''],
                    ],
                    columns: [{}, { type: 'date' }],
                    order: [],
                    paging: false,
                });

                table.setFilters([{ column: 1, operator: 'between', value: ['2026-01-01', '2026-01-31'] }]);
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['Start', 'End']);
        });

        test('uses hidden columns, nested accessors, and filter renderers', async ({ page }) => {
            const rows = await page.evaluate(() => {
                const table = window.createTable({
                    data: [
                        { person: { team: 'Engineering' }, score: { amount: 90 } },
                        { person: { team: 'Design' }, score: { amount: 95 } },
                    ],
                    columns: [
                        { data: 'person.team', visible: false },
                        {
                            data: 'score',
                            type: 'number',
                            render: (value, { purpose }) => purpose === 'display' ? 'Score' : value.amount,
                        },
                    ],
                });

                table.setFilters([
                    { column: 0, operator: 'contains', value: 'ENGINE' },
                    { column: 1, operator: 'gte', value: 90 },
                ]);

                return table.getColumn('person.team');
            });

            expect(rows).toEqual(['Engineering']);
            await expect(page.locator('tbody td')).toHaveText(['Score']);
        });

        test('uses DOM search overrides and preserves zero, false, and empty text', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td data-search="alias"><strong>Alice</strong></td><td>0</td></tr>' +
                    '<tr><td data-search=""><em>Bob</em></td><td>false</td></tr>');

                const table = window.createTable({ data: null });

                table.setFilters([
                    { column: 0, operator: 'equals', value: 'ALIAS' },
                    { column: 1, operator: 'equals', value: 0 },
                ]);
            });

            await expect(page.locator('tbody td')).toHaveText(['Alice', '0']);

            await page.evaluate(() => $('#table').table('setFilters', [
                { column: 0, operator: 'equals', value: null },
                { column: 1, operator: 'equals', value: false },
            ]));

            await expect(page.locator('tbody td')).toHaveText(['Bob', 'false']);
        });

        test('copies descriptors and bounds and reapplies filters after data edits', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({
                    columns: [{}, { type: 'number' }],
                    paging: false,
                });
                const filters = [{ column: 1, operator: 'between', value: [2, 3] }];

                table.setFilters(filters);
                filters[0].value[0] = 100;
                filters[0].column = 0;
                filters.push({ column: 0, operator: 'equals', value: 'Missing' });
                table.addRow(['New', 2]);
                table.setValue(0, 1, 10, { modified: false });
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['A', 'New']);
        });

        for (const { name, filters, error } of [
            { name: 'nonarray', filters: null, error: 'TypeError' },
            { name: 'nonobject', filters: [null], error: 'TypeError' },
            {
                name: 'column',
                filters: [{ column: 9, operator: 'equals', value: 1 }],
                error: 'RangeError',
            },
            {
                name: 'operator',
                filters: [{ column: 1, operator: 'regex', value: 1 }],
                error: 'TypeError',
            },
            {
                name: 'value',
                filters: [{ column: 1, operator: 'equals', value: {} }],
                error: 'TypeError',
            },
            {
                name: 'nonfinite value',
                filters: [{ column: 1, operator: 'equals', value: Infinity }],
                error: 'TypeError',
            },
            {
                name: 'missing typed value',
                filters: [{ column: 1, operator: 'equals', value: null }],
                error: 'TypeError',
            },
            {
                name: 'range length',
                filters: [{ column: 1, operator: 'between', value: [1] }],
                error: 'TypeError',
            },
            {
                name: 'reversed range',
                filters: [{ column: 1, operator: 'between', value: [3, 1] }],
                error: 'RangeError',
            },
            {
                name: 'untyped range',
                filters: [{ column: 0, operator: 'gt', value: 'A' }],
                error: 'TypeError',
            },
        ]) {
            test(`rejects an invalid ${name} without changing filters or page`, async ({ page }) => {
                const result = await page.evaluate(({ filters }) => {
                    const table = window.createTable({ columns: [{}, { type: 'number' }] });

                    table.setFilters([{ column: 1, operator: 'gte', value: 1 }]);
                    table.page(2);

                    let error;

                    try {
                        table.setFilters(filters === null ? filters : [{ column: 0, operator: 'equals', value: 'Missing' }, ...filters]);
                    } catch (caught) {
                        error = caught.name;
                    }

                    table.reload();

                    return {
                        error,
                        rows: table.getColumn(0),
                        info: table.info(),
                    };
                }, { filters });

                expect(result.error).toEqual(error);
                expect(result.rows).toEqual(['B', 'C']);
                expect(result.info).toEqual({
                    start: 2,
                    end: 4,
                    total: 4,
                    filtered: 4,
                });
            });
        }

        test('rejects nonsearchable columns', async ({ page }) => {
            const error = await page.evaluate(() => {
                const table = window.createTable({ columns: [{ searchable: false }, {}] });

                try {
                    table.setFilters([{ column: 0, operator: 'equals', value: 'A' }]);
                } catch (error) {
                    return error.name;
                }
            });

            expect(error).toBe('TypeError');
        });
    });

    test.describe('#setRowFilter', () => {
        test('combines a source-row predicate with column filters and clears it independently', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });

                table.setFilters([{ column: 0, operator: 'equals', value: 'A' }]);
                table.setRowFilter(function(row) {
                    if (this !== table) {
                        throw new Error('Invalid predicate receiver.');
                    }

                    return row[1] > 1;
                });
            });

            await expect(page.locator('tbody td:last-child')).toHaveText(['3']);

            await page.evaluate(() => $('#table').table('setRowFilter', null));

            await expect(page.locator('tbody td:last-child')).toHaveText(['1', '3']);
        });

        test('validates predicates and their return values and clears loading on errors', async ({ page }) => {
            const errors = await page.evaluate(() => {
                const table = window.createTable();
                const errors = [];

                for (const [name, predicate] of [
                    ['non-function predicate', true],
                    ['non-boolean predicate result', () => 1],
                ]) {
                    try {
                        table.setRowFilter(predicate);
                    } catch (error) {
                        errors.push({ name, error: error.name });
                    }
                }

                table.setRowFilter(null);

                return errors;
            });

            expect(errors).toEqual([
                { name: 'non-function predicate', error: 'TypeError' },
                { name: 'non-boolean predicate result', error: 'TypeError' },
            ]);
            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
        });
    });

    test.describe('lifecycle', () => {
        for (const method of ['setFilters', 'setRowFilter']) {
            test(`shows noResults for ${method} and clears filtering with the data`, async ({ page }) => {
                await page.evaluate((method) => {
                    const table = window.createTable();

                    table[method](method === 'setFilters' ? [{ column: 0, operator: 'equals', value: 'Missing' }] : () => false);
                }, method);

                await expect(page.locator('tbody td')).toHaveText('No results to show');

                await page.evaluate(() => {
                    $('#table').table('clear');
                    $('#table').table('addRow', ['Fresh', 5]);
                });

                await expect(page.locator('tbody td')).toHaveText(['Fresh', '5']);
            });

            test(`ignores ${method} when searching is disabled`, async ({ page }) => {
                await page.evaluate((method) => window.createTable({ searching: false })[method](undefined), method);

                await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
            });

            test(`allows disposal from the ${method} notification`, async ({ page }) => {
                await page.evaluate((method) => {
                    const table = window.createTable();

                    $.addEvent('#table', 'filter.ui.table', () => table.dispose());
                    table[method](method === 'setFilters' ? [] : null);
                }, method);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('stops filtering after a renderer disposes the table', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                columns: [
                    {
                        render(value, { purpose }) {
                            if (purpose === 'filter') {
                                this.dispose();
                            }

                            return value;
                        },
                    },
                    {},
                ],
            }).setFilters([{ column: 0, operator: 'equals', value: 'A' }]));

            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });

        test('retains a newer filter change started by a row predicate', async ({ page }) => {
            await page.evaluate(() => {
                let changed = false;

                window.createTable({
                    layout: { top: '', bottom: 'info' },
                }).setRowFilter(function() {
                    if (!changed) {
                        changed = true;
                        this.setFilters([{ column: 0, operator: 'equals', value: 'C' }]);
                    }

                    return true;
                });
            });

            await expect(page.locator('tbody td')).toHaveText(['C', '4']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
        });
    });
});
