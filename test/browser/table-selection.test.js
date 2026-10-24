import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table selection', () => {
    test.beforeEach(setupTable);

    test.describe('selection API', () => {
        test('requires configured identity and a supported mode', async ({ page }) => {
            const result = await page.evaluate(() => {
                const errors = [];

                for (const options of [{ selection: 'multiple' }, { rowId: 1, selection: true }]) {
                    try {
                        window.createTable(options);
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                const table = window.createTable({ rowId: 1 });

                for (const method of ['setSelectedIds', 'selectRows', 'deselectRows']) {
                    try {
                        table[method]([]);
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                return {
                    errors,
                    ids: table.getSelectedIds(),
                };
            });

            expect(result.errors).toEqual(Array(5).fill('TypeError'));
            expect(result.ids).toEqual([]);
        });

        test('combines page, filtered, and all scopes without changing view or drawing', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });
                const state = table.getState();
                let draws = 0;
                let states = 0;

                $.addEvent('#table', 'draw.ui.table', () => draws++);
                $.addEvent('#table', 'statechange.ui.table', () => states++);
                table.selectRows();

                const first = table.getSelectedIds();

                table.selectRows({ scope: 'all' });
                table.deselectRows();

                const other = table.getSelectedIds();
                const unchanged = JSON.stringify(state) === JSON.stringify(table.getState());
                const counts = { draws, states };

                table.search('A');
                table.selectRows({ scope: 'filtered' });
                table.deselectRows({ scope: 'filtered' });

                return {
                    first,
                    other,
                    unchanged,
                    counts,
                    selected: table.getSelectedIds(),
                };
            });

            expect(result.first).toEqual([1, 3]);
            expect(result.other).toEqual([2, 4]);
            expect(result.unchanged).toBe(true);
            expect(result.counts).toEqual({
                draws: 0,
                states: 0,
            });
            expect(result.selected).toEqual([2, 4]);
        });

        test('validates the complete selection and retains insertion order for equivalent sets', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });
                const events = [];

                $.addEvent('#table', 'selectionchange.ui.table', (event) => events.push(event.detail));
                table.setSelectedIds([3, 1, 3]);
                table.setSelectedIds([1, 3]);

                const errors = [];

                for (const ids of [null, [1, 9], [1, null], [true], [1, '1']]) {
                    try {
                        table.setSelectedIds(ids);
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                const copy = table.getSelectedIds();

                copy.push(2);
                events[0].selectedIds.push(4);

                return {
                    ids: table.getSelectedIds(),
                    errors,
                    count: events.length,
                    added: events[0].addedIds,
                };
            });

            expect(result.ids).toEqual([3, 1]);
            expect(result.count).toBe(1);
            expect(result.added).toEqual([3, 1]);
            expect(result.errors).toEqual(['TypeError', 'RangeError', 'TypeError', 'TypeError', 'RangeError']);
        });

        test('preserves hidden selections and view restoration, pruning only removed local IDs', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });
                const state = table.getState();

                table.setSelectedIds([1, 2, 3]);
                table.search('C');
                table.hideColumn(0);
                table.setState(state);

                const preserved = table.getSelectedIds();
                const events = [];

                $.addEvent('#table', 'selectionchange.ui.table', (event) => events.push(event.detail));
                table.setRowById(1, ['Renamed', 1]);
                table.setData([['One', 1], ['Three', 3], ['New', 5]]);
                table.removeRowById(1);
                table.clear();

                return {
                    preserved,
                    events,
                    selected: table.getSelectedIds(),
                };
            });

            expect(result.preserved).toEqual([1, 2, 3]);
            expect(result.selected).toEqual([]);
            expect(result.events).toEqual([
                { selectedIds: [1, 3], addedIds: [], removedIds: [2] },
                { selectedIds: [3], addedIds: [], removedIds: [1] },
                { selectedIds: [], addedIds: [], removedIds: [3] },
            ]);
        });

        test('rejects multiple final IDs in single mode without changing the previous selection', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'single',
                });

                table.setSelectedIds([2]);

                const errors = [];

                for (const update of [() => table.setSelectedIds([1, 3]), () => table.selectRows()]) {
                    try {
                        update();
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                return {
                    errors,
                    selected: table.getSelectedIds(),
                };
            });

            expect(result.errors).toEqual(['RangeError', 'RangeError']);
            expect(result.selected).toEqual([2]);
        });
    });

    test.describe('controls', () => {
        test('uses a page-specific checkbox and preserves focus while selecting with the keyboard', async ({ page }) => {
            await page.evaluate(() => {
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                    layout: { top: 'selection,search', bottom: 'info,pagination' },
                });
            });

            const header = page.getByRole('checkbox', { name: 'Select all rows on this page' });
            const first = page.getByRole('checkbox', { name: 'Select row 1', exact: true });

            await first.focus();
            await first.press('Space');
            await expect(first).toBeFocused();
            await expect(first).toBeChecked();
            await expect(header).toBeChecked({ indeterminate: true });
            await expect(page.locator('tbody tr.table-active')).toHaveCount(1);
            await expect(page.getByRole('status').filter({ hasText: 'selected' })).toHaveText('1 selected');

            await header.check();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([1, 3]);
            await page.evaluate(() => window.table.page(2));
            await expect(header).not.toBeChecked();
            await expect(header).not.toBeChecked({ indeterminate: true });
            await header.check();
            await header.uncheck();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([1, 3]);
            await page.getByRole('button', { name: 'Clear selection' }).click();
            await expect(page.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([]);
        });

        test('selects mounted rows when a page draw is cancelled and follows the next completed draw', async ({ page }) => {
            await page.evaluate(() => {
                window.cancelDraw = false;
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                    preDrawCallback: () => !window.cancelDraw,
                });
                window.table.setSelectedIds([1, 2]);
                window.cancelDraw = true;
                window.table.page(2);
            });

            const header = page.getByRole('checkbox', { name: 'Select all rows on this page' });

            await expect(page.locator('tbody td:last-child')).toHaveText(['1', '3']);
            await expect(header).toBeChecked({ indeterminate: true });

            await header.check();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([1, 2, 3]);
            await expect(page.getByRole('checkbox', { name: 'Select row 3', exact: true })).toBeChecked();
            await header.uncheck();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([2]);

            await page.evaluate(() => {
                window.cancelDraw = false;
                window.table.refresh();
            });

            await expect(page.locator('tbody td:last-child')).toHaveText(['2', '4']);
            await expect(header).toBeChecked({ indeterminate: true });
            await header.check();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([2, 4]);
        });

        test('excludes removed mounted rows from header selection after a cancelled draw', async ({ page }) => {
            await page.evaluate(() => {
                window.cancelDraw = false;
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                    preDrawCallback: () => !window.cancelDraw,
                });
                window.cancelDraw = true;
                window.table.setData([['A', 3], ['New', 5]]);
                window.table.setSelectedIds([3, 5]);
            });

            const header = page.getByRole('checkbox', { name: 'Select all rows on this page' });

            await expect(page.locator('tbody td:last-child')).toHaveText(['1', '3']);
            await expect(page.getByRole('checkbox', { name: 'Select row 1', exact: true })).toBeDisabled();
            await expect(header).toBeChecked();
            await expect(header).not.toBeChecked({ indeterminate: true });

            await header.uncheck();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([5]);
            await header.check();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([5, 3]);

            await page.evaluate(() => window.table.setData([]));

            await expect(header).toBeDisabled();
            await expect(header).not.toBeChecked();
            await expect(header).not.toBeChecked({ indeterminate: true });
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([]);
        });

        test('uses radios to replace single selection and keeps controls out of data operations', async ({ page }) => {
            await page.evaluate(() => window.table = window.createTable({
                rowId: 1,
                selection: 'single',
            }));
            await expect(page.getByRole('checkbox')).toHaveCount(0);
            await page.getByRole('radio', { name: 'Select row 1', exact: true }).check();
            await page.getByRole('radio', { name: 'Select row 3', exact: true }).check();

            const result = await page.evaluate(() => ({
                ids: window.table.getSelectedIds(),
                data: window.table.getData(),
                exported: window.table.getExportData(),
                columns: window.table.getState().columns.length,
            }));

            expect(result.ids).toEqual([3]);
            expect(result.data).toEqual([['A', 1], ['A', 3]]);
            expect(result.exported).toEqual({
                headings: ['Name', 'Score'],
                rows: [['A', 1], ['A', 3]],
            });
            expect(result.columns).toBe(2);
            await expect(page.getByRole('radio', { name: 'Select row 1', exact: true })).not.toBeChecked();
        });

        test('keeps utility cells first through visibility changes and handles empty results', async ({ page }) => {
            await page.evaluate(() => {
                $.append('#table', $.create('tfoot', { html: '<tr><td>Total</td><td>10</td></tr>' }));
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });
                window.table.hideColumn(0);
                window.table.showColumn(0);
            });

            await expect(page.locator('thead th').first().getByRole('checkbox')).toHaveCount(1);
            await expect(page.locator('thead th')).toHaveCount(3);
            await expect(page.locator('tfoot td')).toHaveCount(3);
            await page.evaluate(() => window.table.search('missing'));
            await expect(page.getByRole('checkbox', { name: 'Select all rows on this page' })).toBeDisabled();
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '3');
            await page.evaluate(() => {
                window.table.hideColumn(0);
                window.table.hideColumn(1);
            });
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '1');
        });

        test('does not sort when selection controls are clicked or select when row links are clicked', async ({ page }) => {
            await page.evaluate(() => {
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                    columns: [{ format: (value) => `<a href="#target">${value}</a>` }, {}],
                });
            });

            const state = await page.evaluate(() => window.table.getState());

            await page.locator('tbody a').first().click();
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([]);
            await page.getByRole('checkbox', { name: 'Select all rows on this page' }).check();
            expect(await page.evaluate(() => window.table.getState())).toEqual(state);
        });

        test('isolates radio groups across table instances and restores original markup on disposal', async ({ page }) => {
            const names = await page.evaluate(() => {
                const clone = $.clone('#table')[0];

                $.setAttribute(clone, { id: 'second' });
                $.append(document.body, clone);
                window.table = window.createTable({
                    rowId: 1,
                    selection: 'single',
                });
                window.second = UI.Table.init(clone, {
                    data: [['Second', 1]],
                    rowId: 1,
                    selection: 'single',
                });

                return $.find('input[type="radio"]').map((input) => input.name);
            });

            expect(names[0]).not.toBe(names.at(-1));
            await page.locator('#table').getByRole('radio').first().check();
            await page.locator('#second').getByRole('radio').check();
            await expect(page.locator('#table').getByRole('radio').first()).toBeChecked();
            await page.evaluate(() => window.table.dispose());
            await expect(page.locator('#table th')).toHaveCount(2);
            await expect(page.locator('#table input')).toHaveCount(0);
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual([]);
        });
    });

    test.describe('event lifecycle', () => {
        test('retains a newer selection made by a notification listener', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });
                const events = [];

                $.addEvent('#table', 'selectionchange.ui.table', (event) => {
                    events.push(event.detail);

                    if (event.detail.selectedIds.includes(1)) {
                        table.setSelectedIds([3]);
                    }
                });
                table.setSelectedIds([1]);

                return {
                    selected: table.getSelectedIds(),
                    events,
                };
            });

            expect(result.selected).toEqual([3]);
            expect(result.events).toEqual([
                { selectedIds: [1], addedIds: [1], removedIds: [] },
                { selectedIds: [3], addedIds: [3], removedIds: [1] },
            ]);
            await expect(page.getByRole('checkbox', { name: 'Select row 3', exact: true })).toBeChecked();
        });

        test('abandons an older data draw when selection pruning triggers replacement', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });

                table.setSelectedIds([1]);
                $.addEvent('#table', 'selectionchange.ui.table', () => table.setData([['Newer', 9]]));
                table.setData([['Obsolete', 5]]);

                return table.getData();
            });

            expect(result).toEqual([['Newer', 9]]);
            await expect(page.locator('tbody td').last()).toHaveText('9');
        });

        test('stops drawing when a selection notification disposes the table', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });

                table.setSelectedIds([1]);
                $.addEvent('#table', 'selectionchange.ui.table', () => table.dispose());
                table.setData([]);

                return {
                    disposed: !table.node,
                    selected: table.getSelectedIds(),
                };
            });

            expect(result.disposed).toBe(true);
            expect(result.selected).toEqual([]);
            await expect(page.locator('#table tbody tr')).toHaveCount(0);
        });
    });
});
