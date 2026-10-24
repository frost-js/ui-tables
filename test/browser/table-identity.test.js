import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table row identity', () => {
    test.beforeEach(setupTable);

    test.describe('configuration', () => {
        test('preserves numeric and string IDs independently, including zero', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    data: [['Zero', 0], ['Number', 42], ['String', '42']],
                    rowId: 1,
                });
                const row = table.getRowById(42);

                row[0] = 'Changed copy';

                return {
                    zero: table.getRowById(0),
                    number: table.getRowById(42),
                    string: table.getRowById('42'),
                    absent: table.getRowById('missing'),
                    sourceId: table.getRowId(0, { modified: false }),
                };
            });

            expect(result.zero).toEqual(['Zero', 0]);
            expect(result.number).toEqual(['Number', 42]);
            expect(result.string).toEqual(['String', '42']);
            expect(result.absent).toBeNull();
            expect(result.sourceId).toBe(0);
        });

        for (const id of [null, '', true, 1.5, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
            test(`rejects invalid identity ${JSON.stringify(id)} without altering source markup`, async ({ page }) => {
                const original = await page.locator('#table').innerHTML();
                const result = await page.evaluate((id) => {
                    try {
                        window.createTable({
                            data: [['Invalid', id]],
                            rowId: 1,
                        });
                    } catch (caught) {
                        return caught.name;
                    }
                }, id);

                expect(result).toBe('TypeError');
                await expect(page.locator('#table')).toHaveJSProperty('innerHTML', original);
            });
        }

        test('rejects duplicate identities and invalid accessors', async ({ page }) => {
            const errors = await page.evaluate(() => {
                const errors = [];

                for (const options of [
                    { rowId: 1, data: [['A', 1], ['B', 1]] },
                    { rowId: '' },
                    { rowId: -1 },
                    { rowId: true },
                    { rowId: {} },
                ]) {
                    try {
                        window.createTable(options);
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                return errors;
            });

            expect(errors).toEqual(Array(5).fill('TypeError'));
        });

        test('supports nested accessors and pure callbacks with the table as receiver', async ({ page }) => {
            const result = await page.evaluate(() => {
                const options = {
                    data: [{ person: { id: 'a' }, name: 'Alice', score: 1 }],
                    columns: [{ data: 'name' }, { data: 'score' }],
                };
                const table = window.createTable({
                    ...options,
                    rowId: 'person.id',
                });
                const nested = table.getRowId(0);

                table.dispose();

                let receiver = true;
                const callbackTable = window.createTable({
                    ...options,
                    rowId(row) {
                        receiver &&= this instanceof UI.Table;

                        return row.person.id;
                    },
                });

                return {
                    nested,
                    callback: callbackTable.getRowId(0),
                    receiver,
                };
            });

            expect(result.nested).toBe('a');
            expect(result.callback).toBe('a');
            expect(result.receiver).toBe(true);
        });

        test('reads DOM identities from source cells without assigning application IDs to elements', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.setHtml('#table tbody', '<tr><td>Alice</td><td>id with spaces</td></tr>');

                const table = window.createTable({
                    data: null,
                    rowId: 1,
                });

                return table.getRowById('id with spaces');
            });

            expect(result).toEqual(['Alice', 'id with spaces']);
            await expect(page.locator('tbody tr')).not.toHaveAttribute('id');
        });
    });

    test.describe('keyed methods', () => {
        test('targets the same record across ordering, filtering, paging, and preceding removals', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ rowId: 1 });
                const first = table.getRowId(0);

                table.order([[1, 'desc']]);
                table.page(2);
                table.removeRowById(2);
                table.search('A');
                table.setRowById(3, ['Updated A', 3]);

                return {
                    first,
                    row: table.getRowById(3),
                    removed: table.getRowById(2),
                    count: table.info().total,
                };
            });

            expect(result.first).toBe(1);
            expect(result.row).toEqual(['Updated A', 3]);
            expect(result.removed).toBeNull();
            expect(result.count).toBe(3);
        });

        test('rejects disabled identity, malformed IDs, and missing mutation targets', async ({ page }) => {
            const errors = await page.evaluate(() => {
                let table = window.createTable();
                const errors = [];
                const attempt = (callback) => {
                    try {
                        callback();
                    } catch (error) {
                        errors.push(error.name);
                    }
                };

                attempt(() => table.getRowById(1));
                attempt(() => table.getRowId(0));
                table.dispose();
                table = window.createTable({ rowId: 1 });
                attempt(() => table.getRowById(null));
                attempt(() => table.setRowById('missing', ['Missing', 9]));
                attempt(() => table.removeRowById('missing'));

                return errors;
            });

            expect(errors).toEqual(['TypeError', 'TypeError', 'TypeError', 'RangeError', 'RangeError']);
        });
    });

    test.describe('atomic mutations', () => {
        test('rejects invalid batches and identity changes without drawing or changing data', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({
                    rowId: 1,
                    selection: 'multiple',
                });

                table.setSelectedIds([1]);

                let draws = 0;
                let events = 0;

                $.addEvent('#table', 'draw.ui.table', () => draws++);
                $.addEvent('#table', 'selectionchange.ui.table', () => events++);

                const errors = [];

                for (const mutate of [
                    () => table.addRow(['Duplicate', 1]),
                    () => table.addRows([['New', 5], ['Duplicate', 1]]),
                    () => table.setData([['New', 5], ['Duplicate', 5]]),
                    () => table.setRow(0, ['Changed', 8]),
                    () => table.setRowById(1, ['Changed', 8]),
                    () => table.setValue(0, 1, 8),
                    () => table.setColumn(1, [1, 8]),
                ]) {
                    try {
                        mutate();
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                return {
                    errors,
                    draws,
                    events,
                    selected: table.getSelectedIds(),
                    rows: table.getData({ scope: 'all' }),
                };
            });

            expect(result.errors).toEqual(Array(7).fill('TypeError'));
            expect(result.draws).toBe(0);
            expect(result.events).toBe(0);
            expect(result.selected).toEqual([1]);
            expect(result.rows).toEqual([['A', 1], ['A', 3], ['B', 2], ['C', 4]]);
        });

        test('validates nested and wildcard writes without changing shared objects', async ({ page }) => {
            const result = await page.evaluate(() => {
                const source = { person: { id: 'a', name: 'Alice' }, score: 1 };
                const table = window.createTable({
                    data: [source],
                    rowId: 'person.id',
                    columns: [{ data: 'person.name' }, { data: 'score' }],
                });
                const errors = [];

                for (const [key, value] of [['person.id', 'b'], ['person', { id: 'b' }], ['*.id', 'b']]) {
                    try {
                        table.setValue(0, key, value);
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                table.setValue(0, 'person.name', 'Updated');

                return {
                    errors,
                    source,
                    row: table.getRowById('a'),
                };
            });

            expect(result.errors).toEqual(Array(3).fill('TypeError'));
            expect(result.source).toEqual({
                person: { id: 'a', name: 'Alice' },
                score: 1,
            });
            expect(result.row).toEqual({
                person: { id: 'a', name: 'Updated' },
                score: 1,
            });
        });

        test('updates maps after insertion, replacement, removal, and clearing', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ rowId: 1 });

                table.addRow(['New', 5]);
                table.addRows([['Another', 6]]);
                table.setColumn(0, ['First', 'Second']);

                const edited = table.getRowById(1);

                table.setData([['Replaced', 6], ['Retained', 1]]);

                const removed = table.getRowById(5);

                table.removeRow(0);

                const remaining = table.getRowById(1);

                table.clear();

                return {
                    edited,
                    removed,
                    remaining,
                    cleared: table.getRowById(1),
                };
            });

            expect(result.edited).toEqual(['First', 1]);
            expect(result.removed).toBeNull();
            expect(result.remaining).toEqual(['Retained', 1]);
            expect(result.cleared).toBeNull();
        });

        test('preserves other DOM cell metadata during identity-aware value writes', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.setHtml('#table tbody', '<tr><td data-export="Export name"><b>Alice</b></td><td>1</td></tr>');

                const table = window.createTable({
                    data: null,
                    rowId: 1,
                });

                table.setValue(0, 1, '1');

                return table.getExportData().rows;
            });

            expect(result).toEqual([['Export name', '1']]);
        });

        test('abandons an update when its identity callback starts a newer mutation', async ({ page }) => {
            const result = await page.evaluate(() => {
                let interrupt = false;
                const table = window.createTable({
                    rowId(row) {
                        if (interrupt) {
                            interrupt = false;
                            this.setData([['Newer', 9]]);
                        }

                        return row[1];
                    },
                });

                interrupt = true;
                table.addRow(['Obsolete', 5]);

                return {
                    rows: table.getData(),
                    absent: table.getRowById(5),
                };
            });

            expect(result.rows).toEqual([['Newer', 9]]);
            expect(result.absent).toBeNull();
        });

        test('stops safely when an identity callback disposes the table', async ({ page }) => {
            const result = await page.evaluate(() => {
                let dispose = false;
                const table = window.createTable({
                    rowId(row) {
                        if (dispose) this.dispose();

                        return row[1];
                    },
                });

                dispose = true;
                table.addRow(['Obsolete', 5]);

                return {
                    disposed: !table.node,
                    selected: table.getSelectedIds(),
                    row: table.getRowById(5),
                };
            });

            expect(result.disposed).toBe(true);
            expect(result.selected).toEqual([]);
            expect(result.row).toBeNull();
            await expect(page.locator('#table tbody tr')).toHaveCount(0);
        });
    });
});
