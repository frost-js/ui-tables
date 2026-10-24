import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table cell values', () => {
    test.beforeEach(setupTable);

    test.describe('column configuration', () => {
        for (const column of [
            { type: 'currency' },
            { compare: true },
            { render: 'text' },
        ]) {
            test(`rejects ${JSON.stringify(column)}`, async ({ page }) => {
                const error = await page.evaluate((column) => {
                    try {
                        window.createTable({ columns: [column, {}] });
                    } catch (error) {
                        return error.name;
                    }
                }, column);

                expect(error).toBe('TypeError');
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('rejects a column with both format and render', async ({ page }) => {
            const error = await page.evaluate(() => {
                try {
                    window.createTable({
                        columns: [{ format: (value) => value, render: (value) => value }, {}],
                    });
                } catch (error) {
                    return error.name;
                }
            });

            expect(error).toBe('TypeError');
        });
    });

    test.describe('render', () => {
        test('resolves display, sort, and filter values without changing raw getters', async ({ page }) => {
            const values = await page.evaluate(() => {
                const table = window.createTable({
                    data: [['Large', { amount: 100, term: 'one hundred' }], ['Small', { amount: 9, term: 'nine' }]],
                    columns: [
                        { searchable: false },
                        {
                            type: 'number',
                            render(value, { purpose, row, column, rowIndex }) {
                                if (this.getValue(rowIndex, column, { modified: false }) !== row[column]) {
                                    throw new Error('Invalid renderer context.');
                                }

                                switch (purpose) {
                                    case 'display':
                                        return `<strong>$${value.amount}</strong><img src="x" onerror="alert(1)">`;
                                    case 'filter':
                                        return value.term;
                                    default:
                                        return value.amount;
                                }
                            },
                        },
                    ],
                    order: [[1, 'asc']],
                });

                return table.getColumn(1);
            });

            expect(values).toEqual([{ amount: 9, term: 'nine' }, { amount: 100, term: 'one hundred' }]);
            await expect(page.locator('tbody strong')).toHaveText(['$9', '$100']);
            await expect(page.locator('tbody [onerror]')).toHaveCount(0);

            await page.evaluate(() => $('#table').table('search', 'hundred'));

            await expect(page.locator('tbody td:first-child')).toHaveText(['Large']);
        });

        for (const remote of [false, true]) {
            test(`passes loaded row indexes on a ${remote ? 'remote' : 'local'} page`, async ({ page }) => {
                await page.evaluate((remote) => {
                    const rows = [['B', 2], ['A', 1], ['D', 4], ['C', 3]];
                    const options = remote ? {
                        getResults: ({ offset, limit }) => ({ results: rows.slice(offset, offset + limit), total: 4, filtered: 4 }),
                    } : { data: rows };

                    window.createTable({
                        ...options,
                        columns: [
                            {
                                render(value, { purpose, rowIndex }) {
                                    return purpose === 'display' ? `${value}:${rowIndex}` : value;
                                },
                            },
                            {},
                        ],
                    });
                }, remote);

                await expect(page.getByRole('button', { name: 'Next Page', exact: true })).toBeEnabled();
                await page.getByRole('button', { name: 'Next Page', exact: true }).click();

                await expect(page.locator('tbody td:first-child')).toHaveText(remote ? ['D:0', 'C:1'] : ['C:3', 'D:2']);
            });
        }
    });

    test.describe('typed sorting', () => {
        for (const { type, data, ascending, descending } of [
            {
                type: 'auto',
                data: ['10', '2', ''],
                ascending: ['', '2', '10'],
                descending: ['10', '2', ''],
            },
            {
                type: 'string',
                data: ['2', '', '10', null],
                ascending: ['10', '2', '', null],
                descending: ['2', '10', '', null],
            },
            {
                type: 'number',
                data: ['10', null, '2', '', 'bad', false],
                ascending: ['2', '10', null, '', 'bad', false],
                descending: ['10', '2', null, '', 'bad', false],
            },
            {
                type: 'date',
                data: ['2026-03-01', '2026-02-29', '2024-02-29', '03/04/2026', '2026-03-01T01:00:00+02:00', '2026-01-01T12:00:00'],
                ascending: ['2024-02-29', '2026-03-01T01:00:00+02:00', '2026-03-01', '2026-02-29', '03/04/2026', '2026-01-01T12:00:00'],
                descending: ['2026-03-01', '2026-03-01T01:00:00+02:00', '2024-02-29', '2026-02-29', '03/04/2026', '2026-01-01T12:00:00'],
            },
        ]) {
            test(`sorts ${type} values in both directions with stable ties`, async ({ page }) => {
                const result = await page.evaluate(({ type, data }) => {
                    const table = window.createTable({
                        data: data.map((value, index) => [value, index]),
                        columns: [{ type }, {}],
                        paging: false,
                    });
                    const ascending = table.getColumn(0);

                    table.order([[0, 'desc']]);

                    return {
                        ascending,
                        descending: table.getColumn(0),
                    };
                }, { type, data });

                expect(result.ascending).toEqual(ascending);
                expect(result.descending).toEqual(descending);
            });
        }

        test('accepts Date objects and epoch milliseconds while rejecting invalid dates', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [['invalid', new Date(NaN)], ['later', new Date('2026-01-01')], ['epoch', 0]],
                columns: [{}, { type: 'date' }],
                order: [[1, 'asc']],
                paging: false,
            }));

            await expect(page.locator('tbody td:first-child')).toHaveText(['epoch', 'later', 'invalid']);
        });

        test('combines custom resolved comparisons, alternate columns, and tie breakers', async ({ page }) => {
            await page.evaluate(() => {
                window.createTable({
                    data: [['B', 'high'], ['A', 'low'], ['C', 'high'], ['D', 'high']],
                    columns: [
                        { orderData: [1, 0] },
                        {
                            render: (value) => value.toUpperCase(),
                            compare(a, b, { column }) {
                                if (column !== 1 || !this.node) {
                                    throw new Error('Invalid comparator context.');
                                }

                                const ranks = { LOW: 0, HIGH: 1 };

                                return ranks[a] - ranks[b];
                            },
                        },
                    ],
                    paging: false,
                });
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['A', 'B', 'C', 'D']);

            await page.evaluate(() => $('#table').table('order', [[0, 'desc']]));

            await expect(page.locator('tbody td:first-child')).toHaveText(['D', 'C', 'B', 'A']);
        });

        test('passes unconverted values to custom comparisons and keeps missing values last', async ({ page }) => {
            await page.evaluate(() => {
                window.createTable({
                    data: [['A', '2'], ['Missing', null], ['B', '10'], ['C', '2']],
                    columns: [
                        {},
                        {
                            type: 'number',
                            compare(a, b) {
                                if (typeof a !== 'string' || typeof b !== 'string') {
                                    throw new Error('Expected resolved strings.');
                                }

                                return a.length - b.length;
                            },
                        },
                    ],
                    order: [[1, 'asc']],
                    paging: false,
                });
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['A', 'C', 'B', 'Missing']);

            await page.evaluate(() => $('#table').table('order', [[1, 'desc']]));

            await expect(page.locator('tbody td:first-child')).toHaveText(['B', 'A', 'C', 'Missing']);
        });

        for (const value of [NaN, Infinity, '1']) {
            test(`rejects a comparator returning ${String(value)}`, async ({ page }) => {
                const error = await page.evaluate((value) => {
                    try {
                        window.createTable({ columns: [{ compare: () => value }, {}] });
                    } catch (error) {
                        return error.name;
                    }
                }, value);

                expect(error).toBe('TypeError');
            });
        }
    });

    test.describe('DOM values', () => {
        test('sorts and searches decoded text instead of cell markup', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td><strong>Alice &amp; Co</strong></td><td>1</td></tr>' +
                    '<tr><td><em>Bob</em></td><td>2</td></tr>');
                window.createTable({ data: null });
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['Alice & Co', 'Bob']);

            await page.evaluate(() => $('#table').table('search', 'strong'));

            await expect(page.locator('tbody td')).toHaveText('No results to show');

            await page.evaluate(() => $('#table').table('search', 'alice & co'));

            await expect(page.locator('tbody td')).toHaveText(['Alice & Co', '1']);
        });

        test('uses text and explicit attributes while retaining source HTML', async ({ page }) => {
            const raw = await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td data-order="2" data-search="alias"><strong>Alice &amp; Co</strong></td><td>1</td></tr>' +
                    '<tr><td data-order="1" data-search=""><em>Bob</em></td><td>2</td></tr>');

                return window.createTable({ data: null }).getColumn(0);
            });

            expect(raw).toEqual(['<em>Bob</em>', '<strong>Alice &amp; Co</strong>']);

            for (const [term, expected] of [
                ['strong', ['No results to show']],
                ['Bob', ['No results to show']],
                ['alias', ['Alice & Co']],
            ]) {
                await page.evaluate((term) => $('#table').table('search', term), term);

                await expect(page.locator('tbody td:first-child')).toHaveText(expected);
            }
        });

        test('keeps metadata with its row and discards overrides for edited cells and rows', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td data-order="9">A</td><td>1</td></tr>' +
                    '<tr><td data-order="0">B</td><td>2</td></tr>' +
                    '<tr><td data-order="1">C</td><td>3</td></tr>');

                const table = window.createTable({
                    data: null,
                    paging: false,
                });

                table.removeRow(0, { modified: false });
            });

            const names = page.locator('tbody td:first-child');

            await expect(names).toHaveText(['B', 'C']);

            await page.evaluate(() => $('#table').table('setValue', 0, 0, 'B', { modified: false }));

            await expect(names).toHaveText(['C', 'B']);

            await page.evaluate(() => $('#table').table('setRow', 1, ['D', 4], { modified: false }));

            await expect(names).toHaveText(['B', 'D']);

            await page.evaluate(() => $('#table').table('setColumn', 0, ['Z', 'A'], { modified: false }));

            await expect(names).toHaveText(['A', 'Z']);
        });

        test('lets an explicit renderer override DOM metadata', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('tbody', '<tr><td data-order="1" data-search="hidden">B</td><td>2</td></tr>' +
                    '<tr><td data-order="2">A</td><td>1</td></tr>');
                window.createTable({
                    data: null,
                    columns: [{ render: (value) => value }, {}],
                }).search('A');
            });

            await expect(page.locator('tbody td')).toHaveText(['A', '1']);
        });
    });

    test.describe('interrupted operations', () => {
        for (const purpose of ['display', 'sort', 'filter']) {
            test(`stops after disposal during ${purpose}`, async ({ page }) => {
                await page.evaluate((purpose) => {
                    const table = window.createTable({
                        columns: [
                            {
                                render(value, context) {
                                    if (context.purpose === purpose) {
                                        this.dispose();
                                    }

                                    return value;
                                },
                            },
                            {},
                        ],
                    });

                    if (purpose === 'filter') {
                        table.search('A');
                    }
                }, purpose);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }

        test('stops after disposal during a comparator', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                columns: [
                    {
                        compare() {
                            this.dispose();

                            return 0;
                        },
                    },
                    {},
                ],
            }));

            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });

        test('retains a newer search started by a filter renderer', async ({ page }) => {
            await page.evaluate(() => {
                let changed = false;

                window.createTable({
                    columns: [
                        {
                            render(value, { purpose }) {
                                if (purpose === 'filter' && !changed) {
                                    changed = true;
                                    this.search('C');
                                }

                                return value;
                            },
                        },
                        {},
                    ],
                }).search('A');
            });

            await expect(page.locator('tbody td')).toHaveText(['C', '4']);
            await expect(page.getByRole('searchbox')).toHaveValue('C');
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
        });
    });
});
