import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table local data', () => {
    test.use({ mockClock: true });

    test.beforeEach(setupTable);

    test.describe('#addRow', () => {
        test('reapplies the active search without counting nonmatches', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                table.search('A');
                table.addRow(['D', 5]);
                table.addRow(['A', 6]);
            });

            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 3 (filtered from 6 total)');

            await page.getByRole('button', { name: 'Next Page', exact: true }).click();

            await expect(page.locator('tbody td')).toHaveText(['A', '6']);
        });
    });

    test.describe('#clear', () => {
        test('resets the search, counts, and pagination before adding fresh rows', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                table.search('A');
                table.clear();
            });

            await expect(page.getByRole('status')).toHaveText('Showing results 0 to 0 of 0');
            await expect(page.getByRole('searchbox')).toHaveValue('');
            await expect(page.locator('tbody td')).toHaveText('No data available');
            await expect(page.getByRole('button', { name: 'Next Page', exact: true })).toBeDisabled();

            await page.evaluate(() => $('#table').table('addRow', ['Fresh', 9]));

            await expect(page.locator('tbody td')).toHaveText(['Fresh', '9']);
        });
    });

    test.describe('#getColumn', () => {
        for (const { name, options, expected } of [
            { name: 'displayed rows', options: {}, expected: [1, 3] },
            { name: 'all original rows', options: { modified: false }, expected: [2, 1, 3, 4] },
        ]) {
            test(`returns column values from ${name}`, async ({ page }) => {
                const values = await page.evaluate((options) => window.createTable().getColumn(1, options), options);

                expect(values).toEqual(expected);
            });
        }
    });

    test.describe('#getRow', () => {
        test('returns a shallow copy', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                const row = table.getRow(0);
                row[0] = 'Changed';
                table.refresh();
            });

            await expect(page.locator('tbody td:first-child')).toHaveText(['A', 'A']);
        });

        test('rejects an invalid row index', async ({ page }) => {
            await page.evaluate(() => window.createTable());

            expect(await page.evaluate(() => {
                try {
                    $('#table').table('getRow', 99);
                } catch (error) {
                    return error.name;
                }
            })).toBe('RangeError');
        });
    });

    test.describe('#hideColumn', () => {
        test('updates empty-state colspan and restores headings in their original order', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({ data: [] });
                table.hideColumn(0);
            });

            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '1');

            await page.evaluate(() => $('#table').table('showColumn', 0));

            await expect(page.locator('thead th')).toHaveText(['Name', 'Score']);
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '2');
        });
    });

    test.describe('#info', () => {
        test('uses zero-based starts and an exclusive end for the displayed page', async ({ page }) => {
            await page.evaluate(() => window.createTable().page(2));
            const info = await page.evaluate(() => $('#table').table('info'));

            expect(info.start).toBe(2);
            expect(info.end).toBe(4);
            expect(info.total).toBe(4);
            expect(info.filtered).toBe(4);
        });
    });

    test.describe('#length', () => {
        test('synchronizes custom lengths with the select and clamps the current page', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                table.page(2);
                table.length(3);
            });

            await expect(page.getByRole('combobox')).toHaveValue('3');
            await expect(page.getByRole('combobox').locator('option')).toHaveText(['2', '4', '3']);
            await expect(page.locator('tbody tr')).toHaveCount(3);
        });

        for (const { name, length } of [
            { name: 'zero', length: 0 },
            { name: 'a negative number', length: -1 },
            { name: 'a fraction', length: 1.5 },
            { name: 'Infinity', length: Infinity },
            { name: 'NaN', length: NaN },
        ]) {
            test(`rejects ${name} as the page length`, async ({ page }) => {
                expect(await page.evaluate((length) => {
                    const table = window.createTable();
                    try {
                        table.length(length);
                    } catch (error) {
                        return error.name;
                    }
                }, length)).toBe('RangeError');
                await expect(page.locator('tbody tr')).toHaveCount(2);
            });
        }
    });

    test.describe('#loading', () => {
        test('exposes busy state and a labeled progress indicator', async ({ page }) => {
            await page.evaluate(() => window.createTable().loading());

            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'true');
            await expect(page.getByRole('progressbar', { name: 'Loading results' })).toBeVisible();

            await page.evaluate(() => $('#table').table('loading', { show: false }));

            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
            await expect(page.getByRole('progressbar', { includeHidden: true })).toBeHidden();
        });
    });

    test.describe('#order', () => {
        test('sorts ties by the next key and supports empty ordering', async ({ page }) => {
            await page.evaluate(() => window.createTable({ order: [[0, 'asc'], [1, 'desc']] }));

            await expect(page.locator('tbody td')).toHaveText(['A', '3', 'A', '1']);

            await page.evaluate(() => $('#table').table('order', []));

            await expect(page.locator('tbody td')).toHaveText(['B', '2', 'A', '1']);
            await expect(page.locator('th[aria-sort]')).toHaveCount(0);
        });

        test('honors an empty initial order and alternate orderData columns', async ({ page }) => {
            await page.evaluate(() => window.createTable({ order: [], columns: [{ orderData: [1] }, {}] }));

            await expect(page.locator('tbody td')).toHaveText(['B', '2', 'A', '1']);

            await page.evaluate(() => $('#table').table('order', [[0, 'desc']]));

            await expect(page.locator('tbody td')).toHaveText(['C', '4', 'A', '3']);
        });

        test('sorts strings that collide with object prototype properties', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [['toString', 1], ['constructor', 2], ['__proto__', 3]],
                paging: false,
            }));

            await expect(page.locator('tbody td:first-child')).toHaveText(['__proto__', 'constructor', 'toString']);
        });
    });

    test.describe('#page', () => {
        test('clamps out-of-range pages and marks the current page', async ({ page }) => {
            await page.evaluate(() => window.createTable().page(999));

            await expect(page.locator('tbody td')).toHaveText(['B', '2', 'C', '4']);
            await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
            await expect(page.getByRole('button', { name: 'Last Page', exact: true })).toBeDisabled();

            await page.evaluate(() => $('#table').table('page', -20));

            await expect(page.getByRole('button', { name: 'First Page', exact: true })).toBeDisabled();
        });
    });

    test.describe('#removeRow', () => {
        test('reindexes results and clamps an emptied final page', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                table.page(2);
                table.removeRow(1);
                table.removeRow(0);
            });

            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 2');
        });
    });

    test.describe('#search', () => {
        for (const ordering of [true, false]) {
            test(`matches each row once and paginates filtered rows (ordering=${ordering})`, async ({ page }) => {
                await page.evaluate((ordering) => {
                    const table = window.createTable({
                        data: [['A', 'A'], ['A', 'B'], ['X', 'C'], ['A', 'D']],
                        ordering,
                        length: 1,
                    });
                    table.page(4);
                    table.search('A');
                }, ordering);

                await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 3 (filtered from 4 total)');
                await expect(page.locator('tbody td')).toHaveText(['A', 'A']);

                await page.getByRole('button', { name: 'Next Page', exact: true }).click();

                await expect(page.locator('tbody td')).toHaveText(['A', 'B']);

                await page.getByRole('button', { name: 'Next Page', exact: true }).click();

                await expect(page.locator('tbody td')).toHaveText(['A', 'D']);
            });
        }

        test('does not leak tied nonmatching rows into sorted results', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [['Tie', 'keep'], ['Tie', 'drop'], ['Tie', 'keep']],
                paging: false,
            }).search('keep'));

            await expect(page.locator('tbody td')).toHaveText(['Tie', 'keep', 'Tie', 'keep']);
        });
    });

    test.describe('#setColumn', () => {
        test('updates displayed rows using their pre-mutation indexes', async ({ page }) => {
            await page.evaluate(() => window.createTable().setColumn(0, ['Z', 'Y']));

            await expect(page.locator('tbody td')).toHaveText(['B', '2', 'C', '4']);
            expect(await page.evaluate(() => $('#table').table('getColumn', 0, { modified: false }))).toEqual(['B', 'Z', 'Y', 'C']);
        });
    });

    for (const { name, edit } of [
        { name: 'setRow', edit: () => $('#table').table('setRow', 0, ['Z', 8]) },
        { name: 'setValue', edit: () => $('#table').table('setValue', 0, 0, 'Z') },
    ]) {
        test.describe(`#${name}`, () => {
            test('reapplies active filtering after an edit', async ({ page }) => {
                await page.evaluate(() => {
                    const table = window.createTable();
                    table.search('A');
                });

                await page.evaluate(edit);

                await expect(page.locator('tbody td')).toHaveText(['A', '3']);
                await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
            });
        });
    }

    test.describe('user events', () => {
        test('pages through a long result set using first, previous, numbered and last controls', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: Array.from({ length: 40 }, (_, index) => [`Row ${index + 1}`, index + 1]),
                order: [[1, 'asc']],
            }));

            await page.getByRole('button', { name: 'Last Page', exact: true }).click();

            await expect(page.locator('tbody td')).toHaveText(['Row 39', '39', 'Row 40', '40']);

            await page.getByRole('button', { name: 'Previous Page', exact: true }).click();

            await expect(page.getByRole('button', { name: 'Page 19', exact: true })).toHaveAttribute('aria-current', 'page');

            await page.getByRole('button', { name: 'First Page', exact: true }).click();
            await page.getByRole('button', { name: 'Page 3', exact: true }).click();

            await expect(page.locator('tbody td')).toHaveText(['Row 5', '5', 'Row 6', '6']);

            await page.getByRole('combobox').selectOption('4');

            await expect(page.locator('tbody tr')).toHaveCount(4);

            await page.evaluate(() => $('#table').table('reload', { reset: true }));

            await expect(page.locator('tbody td:first-child')).toHaveText(['Row 1', 'Row 2', 'Row 3', 'Row 4']);
        });

        test('debounces typed local search', async ({ page }) => {
            await page.evaluate(() => window.createTable({ debounce: 20 }));

            await page.getByRole('searchbox').fill('A');

            await page.clock.runFor(19);

            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 4');

            await page.clock.runFor(1);

            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
            await expect(page.getByRole('status')).toContainText('of 2 (filtered from 4 total)');
        });

        test('appends a shift-sort key to filtered results', async ({ page }) => {
            await page.evaluate(() => window.createTable().search('A'));

            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });
            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });

            await expect(page.locator('tbody td')).toHaveText(['A', '3', 'A', '1']);
        });

        test('leaves nonorderable headings and disabled features unchanged', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                columns: [{ orderable: false }, {}],
                paging: false,
                searching: false,
            }));

            await page.getByRole('columnheader', { name: 'Name', exact: true }).click();

            await page.evaluate(() => {
                const table = $('#table').table();
                table.search('missing');
                table.page(5);
                table.length(1);
            });

            await expect(page.locator('tbody tr')).toHaveCount(4);
            await expect(page.getByRole('searchbox')).toHaveCount(0);
            await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).not.toHaveAttribute('tabindex');
        });

        test('sorts the correct column after an earlier column is hidden', async ({ page }) => {
            await page.evaluate(() => window.createTable({ columns: [{ visible: false }, {}] }));

            await page.getByRole('columnheader', { name: /Score/ }).press('Enter');

            await expect(page.locator('tbody td')).toHaveText(['1', '2']);

            await page.getByRole('columnheader', { name: /Score/ }).press('Space');

            await expect(page.locator('tbody td')).toHaveText(['4', '3']);
        });

        test('removes the last shift-sort key without crashing', async ({ page }) => {
            await page.evaluate(() => window.createTable());

            await page.getByRole('columnheader', { name: /Name/ }).click({ modifiers: ['Shift'] });
            await page.getByRole('columnheader', { name: /Name/ }).click({ modifiers: ['Shift'] });

            await expect(page.locator('th[aria-sort]')).toHaveCount(0);
            await expect(page.locator('tbody td')).toHaveText(['B', '2', 'A', '1']);
        });
    });

    test.describe('paging option', () => {
        test('renders all rows when paging is disabled', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                paging: false,
                length: 1,
            }));

            await expect(page.locator('#table tbody tr')).toHaveCount(4);
            await expect(page.locator('[data-ui-page]')).toHaveCount(0);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 4 of 4');
        });
    });

    test.describe('data option', () => {
        test('renders supplied object rows with nested column paths', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [{ name: 'Zoe', result: { score: 8 } }, { name: 'Ada', result: { score: 9 } }],
                columns: [{ data: 'name' }, { data: 'result.score' }],
            }));

            await expect(page.locator('#table tbody td')).toHaveText(['Ada', '9', 'Zoe', '8']);
        });
    });
});
