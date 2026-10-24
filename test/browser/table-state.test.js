import { expect, test } from '#test';
import { setupClock } from '../setup/browser.js';
import { setupTable } from '../setup/table.js';

test.describe('Table state', () => {
    test.beforeEach(setupTable);

    test.describe('#getState', () => {
        test('returns a serializable view without data or callbacks', async ({ page }) => {
            const state = await page.evaluate(() => {
                const table = window.createTable({ columns: [{ name: 'name' }, { name: 'score', type: 'number' }] });
                table.setRowFilter(() => true);

                return JSON.parse(JSON.stringify(table.getState()));
            });

            expect(state).toEqual({
                version: 1,
                search: '',
                filters: [],
                order: [[0, 'asc']],
                length: 2,
                page: 1,
                columns: [{ data: 0, name: 'name', visible: true }, { data: 1, name: 'score', visible: true }],
            });
        });

        test('returns independent filters, bounds, order, and column objects', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });
                table.setFilters([{ column: 1, operator: 'between', value: [1, 3] }]);
                const expected = table.getState();
                const state = table.getState();
                state.filters[0].value[0] = 99;
                state.filters[0].column = 0;
                state.filters.push({ column: 0, operator: 'equals', value: 'Missing' });
                state.order[0][1] = 'desc';
                state.columns[0].visible = false;
                state.columns.pop();

                return { expected, actual: table.getState() };
            });

            expect(result.actual).toEqual(result.expected);
        });

        test('represents disabled features with an empty order and unpaged values', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ paging: false, ordering: false, searching: false });
                const state = table.getState();
                table.setState(JSON.parse(JSON.stringify(state)));

                return { state, restored: table.getState() };
            });

            expect(result.state).toMatchObject({ length: null, page: 1, order: [], search: '', filters: [] });
            expect(result.restored).toEqual(result.state);
        });
    });

    test.describe('#setState', () => {
        test('restores the complete view and controls with one recalculation and notification', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable({ columns: [{}, { type: 'number' }] });
                const state = table.getState();
                state.search = 'A';
                state.filters = [{ column: 1, operator: 'gte', value: 1 }];
                state.order = [[1, 'desc']];
                state.length = 1;
                state.page = 2;
                state.columns[0].visible = false;

                const expected = JSON.parse(JSON.stringify(state));
                let processing = 0;
                let draws = 0;
                const notifications = [];
                $.addEvent('#table', 'processing.ui.table', () => processing++);
                $.addEvent('#table', 'draw.ui.table', () => draws++);
                $.addEvent('#table', 'statechange.ui.table', (event) => notifications.push(event.detail.state));
                table.setState(state);
                state.filters[0].value = 99;
                state.order[0][1] = 'asc';
                state.columns[0].visible = true;

                return { expected, actual: table.getState(), processing, draws, notifications };
            });

            expect(result.actual).toEqual(result.expected);
            expect(result.notifications).toEqual([result.expected]);
            expect(result.processing).toBe(1);
            expect(result.draws).toBe(1);
            await expect(page.locator('thead th')).toHaveText(['Score']);
            await expect(page.locator('tbody td')).toHaveText(['1']);
            await expect(page.getByRole('searchbox')).toHaveValue('A');
            await expect(page.getByRole('combobox')).toHaveValue('1');
            await expect(page.getByRole('status')).toHaveText('Showing results 2 to 2 of 2 (filtered from 4 total)');
        });

        test('clamps a saved page after data shrinks and retains the active row predicate', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable();
                table.page(2);
                const saved = JSON.parse(JSON.stringify(table.getState()));
                table.setRowFilter((row) => row[1] > 1);
                table.setData([['Excluded', 1], ['Kept', 2]]);
                const notifications = [];
                $.addEvent('#table', 'statechange.ui.table', (event) => notifications.push(event.detail.state));
                table.setState(saved);

                return { page: table.getState().page, rows: table.getData(), notifications };
            });

            expect(result.page).toBe(1);
            expect(result.rows).toEqual([['Kept', 2]]);
            expect(result.notifications).toEqual([]);
        });

        test('cancels pending search input before restoring the saved search', async ({ page }) => {
            await setupClock(page);
            await page.evaluate(() => {
                window.createTable({ debounce: 50 });
                window.draws = 0;
                $.addEvent('#table', 'draw.ui.table', () => window.draws++);
            });
            await page.getByRole('searchbox').fill('C');
            await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));
                const state = table.getState();
                state.search = 'A';
                table.setState(state);
            });

            await page.clock.runFor(100);

            expect(await page.evaluate(() => window.draws)).toBe(1);
            await expect(page.getByRole('searchbox')).toHaveValue('A');
            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
        });

        for (const { name, patch, error } of [
            { name: 'version', patch: { version: 2 }, error: 'TypeError' },
            { name: 'search', patch: { search: null }, error: 'TypeError' },
            { name: 'filters', patch: { filters: [{ column: 9, operator: 'equals', value: 'A' }] }, error: 'RangeError' },
            { name: 'order', patch: { order: [[0, 'invalid']] }, error: 'TypeError' },
            { name: 'length', patch: { length: 0 }, error: 'RangeError' },
            { name: 'numeric string length', patch: { length: '2' }, error: 'RangeError' },
            { name: 'page', patch: { page: 0 }, error: 'RangeError' },
            { name: 'offset overflow', patch: { page: Number.MAX_SAFE_INTEGER, length: 2 }, error: 'RangeError' },
            { name: 'column count', patch: { columns: [] }, error: 'TypeError' },
            { name: 'column identity', patch: { columns: [{ data: '0', name: null, visible: true }, { data: 1, name: null, visible: true }] }, error: 'TypeError' },
            { name: 'column name', patch: { columns: [{ data: 0, name: 'renamed', visible: true }, { data: 1, name: null, visible: true }] }, error: 'TypeError' },
            { name: 'visibility', patch: { columns: [{ data: 0, name: null, visible: 'false' }, { data: 1, name: null, visible: true }] }, error: 'TypeError' },
        ]) {
            test(`rejects an invalid ${name} without partially restoring state`, async ({ page }) => {
                const result = await page.evaluate((patch) => {
                    const table = window.createTable();
                    table.page(2);
                    const before = table.getState();
                    let error;
                    let events = 0;
                    $.addEvent('#table', 'processing.ui.table statechange.ui.table', () => events++);

                    try {
                        table.setState({ ...before, search: 'Missing', ...patch });
                    } catch (caught) {
                        error = caught.name;
                    }

                    return { before, after: table.getState(), error, events };
                }, patch);

                expect(result.error).toBe(error);
                expect(result.after).toEqual(result.before);
                expect(result.events).toBe(0);
                await expect(page.getByRole('searchbox')).toHaveValue('');
            });
        }

        for (const { options, patch } of [
            { options: { searching: false }, patch: { search: 'A' } },
            { options: { searching: false }, patch: { filters: [{ column: 0, operator: 'equals', value: 'A' }] } },
            { options: { ordering: false }, patch: { order: [[0, 'asc']] } },
            { options: { columns: [{ orderable: false }, {}] }, patch: { order: [[0, 'asc']] } },
            { options: { paging: false }, patch: { length: 2 } },
            { options: { paging: false }, patch: { page: 2 } },
        ]) {
            test(`rejects state requiring disabled features ${JSON.stringify({ options, patch })}`, async ({ page }) => {
                const error = await page.evaluate(({ options, patch }) => {
                    const table = window.createTable(options);

                    try {
                        table.setState({ ...table.getState(), ...patch });
                    } catch (error) {
                        return error.name;
                    }
                }, { options, patch });

                expect(error).toBe('TypeError');
            });
        }
    });

    test.describe('statechange event', () => {
        test('notifies once per view change and suppresses equivalent snapshots', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable();
                const notifications = [];
                $.addEvent('#table', 'statechange.ui.table', (event) => notifications.push(event.detail.state));
                table.search('A');
                table.search('A');
                table.order([[1, 'desc']]);
                table.hideColumn(0);
                table.hideColumn(0);
                table.length(1);
                table.page(2);
                table.setState(JSON.parse(JSON.stringify(table.getState())));
                table.refresh();
                table.clear();

                return notifications;
            });

            expect(result).toHaveLength(6);
            expect(result[0].search).toBe('A');
            expect(result[1].order).toEqual([[1, 'desc']]);
            expect(result[2].columns[0].visible).toBe(false);
            expect(result[3].length).toBe(1);
            expect(result[4].page).toBe(2);
            expect(result[5]).toMatchObject({ search: '', filters: [], page: 1 });
        });

        test('isolates event payloads and notifies when a data edit clamps the page', async ({ page }) => {
            const result = await page.evaluate(() => {
                const table = window.createTable();
                let changes = 0;
                $.addEvent('#table', 'statechange.ui.table', (event) => {
                    changes++;
                    event.detail.state.columns[0].visible = false;
                    event.detail.state.order[0][1] = 'desc';
                });
                table.page(2);
                table.removeRow(3, { modified: false });
                table.removeRow(2, { modified: false });

                return { changes, state: table.getState() };
            });

            expect(result.changes).toBe(2);
            expect(result.state.page).toBe(1);
            expect(result.state.columns[0].visible).toBe(true);
            expect(result.state.order).toEqual([[0, 'asc']]);
        });

        test('stops an obsolete draw when a listener restores another state', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                $.addEvent('#table', 'statechange.ui.table', (event) => {
                    if (event.detail.state.search === 'A') {
                        table.setState({ ...table.getState(), search: 'C' });
                    }
                });
                table.setState({ ...table.getState(), search: 'A' });
            });

            await expect(page.locator('tbody td')).toHaveText(['C', '4']);
            await expect(page.getByRole('searchbox')).toHaveValue('C');
            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
        });

        test('allows disposal during a state notification', async ({ page }) => {
            const state = await page.evaluate(() => {
                const table = window.createTable();
                $.addEvent('#table', 'statechange.ui.table', () => table.dispose());
                table.hideColumn(0);

                return table.getState();
            });

            expect(state).toBeNull();
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
    });
});
