import { expect, test } from '#test';

test.describe('Table remote results', () => {
    test.use({ mockClock: true });

    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body,
                '<table id="table">' +
                '<thead><tr><th>Name</th></tr></thead>' +
                '<tbody><tr><td>Original</td></tr></tbody></table>',
            );

            window.requests = [];
            window.startRemote = (options = {}) => UI.Table.init($.findOne('#table'), {
                debounce: 20,
                length: 2,
                getResults(request) {
                    const entry = { request };

                    // Tests control when each request settles, including after cancellation.
                    const pending = new Promise((resolve, reject) => {
                        entry.resolve = resolve;
                        entry.reject = reject;
                    });
                    pending.cancel = () => {
                        $.setDataset(document.body, 'cancelled', ($.getDataset(document.body, 'cancelled') || 0) + 1);
                    };
                    window.requests.push(entry);
                    $.setDataset(document.body, 'requests', window.requests.length);

                    return pending;
                },
                ...options,
            });
        });
    });

    test.describe('responses', () => {
        test('renders a remote response through the bundled component', async ({ page }) => {
            await page.evaluate(() => $.append('thead tr', $.create('th', { text: 'Score' })));

            await page.evaluate(() => UI.Table.init($.findOne('#table'), {
                getResults: async () => ({ results: [['Remote', 42]], total: 1, filtered: 1 }),
                debounce: 0,
            }));

            await page.clock.runFor(1);

            await expect(page.locator('#table tbody td')).toHaveText(['Remote', '42']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1');
        });

        test('sends numeric-keyed request records and accepts empty results', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);

            const request = await page.evaluate(() => window.requests[0].request);

            expect(Array.isArray(request.columns)).toBe(false);
            expect(request.columns[0].data).toBe(0);
            expect(request.order[0].dir).toBe('asc');
            expect(request.offset).toBe(0);
            expect(request.limit).toBe(2);

            await page.evaluate(() => window.requests[0].resolve({ results: [], total: 0, filtered: 0 }));

            await expect(page.locator('tbody td')).toHaveText('No data available');
            expect(await page.evaluate(() => $('#table').table('getColumn', 0))).toHaveLength(0);
            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
        });
    });

    test.describe('row identity and selection', () => {
        test('retains unloaded IDs across pages and selection changes do not load data', async ({ page }) => {
            await page.evaluate(() => window.table = window.startRemote({ rowId: 0, selection: 'multiple' }));
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [['One'], ['Two']], total: 4, filtered: 4 }));
            await expect(page.locator('tbody tr')).toHaveCount(2);
            await page.evaluate(() => {
                window.table.setSelectedIds(['One', 'Unloaded']);
                window.table.page(2);
            });
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[1].resolve({ results: [['Three'], ['Four']], total: 4, filtered: 4 }));
            await expect(page.getByRole('checkbox', { name: 'Select row Three', exact: true })).toBeVisible();
            const result = await page.evaluate(() => {
                window.table.selectRows();
                window.table.deselectRows();
                const errors = [];

                for (const method of ['selectRows', 'deselectRows']) {
                    for (const scope of ['filtered', 'all']) {
                        try {
                            window.table[method]({ scope });
                        } catch (error) {
                            errors.push(error.name);
                        }
                    }
                }

                return {
                    selected: window.table.getSelectedIds(), errors, requests: window.requests.length,
                    absent: window.table.getRowById('One'), loaded: window.table.getRowById('Three'),
                };
            });

            expect(result).toEqual({
                selected: ['One', 'Unloaded'], errors: Array(4).fill('RangeError'), requests: 2,
                absent: null, loaded: ['Three'],
            });
            await page.clock.runFor(25);
            expect(await page.evaluate(() => window.requests.length)).toBe(2);
        });

        test('rejects invalid identity responses without replacing rows, counts, or selection', async ({ page }) => {
            await page.evaluate(() => {
                window.errors = [];
                $.addEvent('#table', 'error.ui.table', (event) => window.errors.push(event.detail.error.name));
                window.table = window.startRemote({ rowId: 0, selection: 'multiple' });
            });
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [['One']], total: 1, filtered: 1 }));
            await expect(page.getByRole('checkbox', { name: 'Select row One', exact: true })).toBeVisible();
            await page.evaluate(() => {
                window.table.setSelectedIds(['One']);
                window.table.reload();
            });
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[1].resolve({ results: [['Duplicate'], ['Duplicate']], total: 2, filtered: 2 }));
            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
            const result = await page.evaluate(() => ({
                row: window.table.getRowById('One'), absent: window.table.getRowById('Duplicate'),
                selected: window.table.getSelectedIds(), total: window.table.info().total, errors: window.errors,
            }));

            expect(result).toEqual({ row: ['One'], absent: null, selected: ['One'], total: 1, errors: ['TypeError'] });
        });

        test('ignores stale identities and invalidates a pending response on keyed removal', async ({ page }) => {
            await page.evaluate(() => window.table = window.startRemote({ rowId: 0, selection: 'multiple' }));
            await page.clock.runFor(25);
            await page.evaluate(() => window.table.reload());
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[1].resolve({ results: [['Current']], total: 1, filtered: 1 }));
            await expect(page.getByRole('checkbox', { name: 'Select row Current', exact: true })).toBeVisible();
            await page.evaluate(() => {
                window.requests[0].resolve({ results: [['Stale']], total: 1, filtered: 1 });
                window.table.setSelectedIds(['Current', 'Unloaded']);
                window.table.reload();
            });
            await page.clock.runFor(25);
            await page.evaluate(() => {
                window.table.removeRowById('Current');
                window.requests[2].resolve({ results: [['Current']], total: 1, filtered: 1 });
            });
            await page.clock.runFor(25);
            const result = await page.evaluate(() => ({
                stale: window.table.getRowById('Stale'), current: window.table.getRowById('Current'),
                selected: window.table.getSelectedIds(), total: window.table.info().total,
            }));

            expect(result).toEqual({ stale: null, current: null, selected: ['Unloaded'], total: 0 });
        });

        test('notifies selection pruning before loading the preceding page after removal', async ({ page }) => {
            await page.evaluate(() => window.table = window.startRemote({ rowId: 0, selection: 'multiple' }));
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [['One'], ['Two']], total: 3, filtered: 3 }));
            await expect(page.locator('tbody tr')).toHaveCount(2);
            await page.evaluate(() => window.table.page(2));
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[1].resolve({ results: [['Three']], total: 3, filtered: 3 }));
            await expect(page.getByRole('checkbox', { name: 'Select row Three', exact: true })).toBeVisible();
            const result = await page.evaluate(() => {
                window.table.setSelectedIds(['Three']);
                const events = [];
                $.addEvent('#table', 'selectionchange.ui.table', (event) => events.push(event.detail));
                window.table.removeRowById('Three');

                return { events, selected: window.table.getSelectedIds() };
            });

            expect(result).toEqual({
                events: [{ selectedIds: [], addedIds: [], removedIds: ['Three'] }], selected: [],
            });
            await expect(page.getByRole('checkbox', { name: 'Select all rows on this page' })).toBeDisabled();
            await expect(page.getByRole('checkbox', { name: 'Select row Three', exact: true })).toBeDisabled();
            await page.clock.runFor(25);
            expect(await page.evaluate(() => window.requests[2].request.offset)).toBe(0);
        });

        test('abandons a response when its identity resolver starts a newer request', async ({ page }) => {
            await page.evaluate(() => {
                let interrupt = true;
                window.table = window.startRemote({
                    rowId(row) {
                        if (interrupt) {
                            interrupt = false;
                            this.search('Newer');
                        }

                        return row[0];
                    },
                });
            });
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [['Obsolete']], total: 1, filtered: 1 }));
            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[1].resolve({ results: [['Newer']], total: 1, filtered: 1 }));
            await expect(page.locator('tbody td')).toHaveText('Newer');
            expect(await page.evaluate(() => window.table.getRowById('Obsolete'))).toBeNull();
        });
    });

    test.describe('errors and retry', () => {
        for (const { name, response } of [
            { name: 'filtered count exceeds total', response: { results: [['One']], total: 0, filtered: 1 } },
            { name: 'results exceed page length', response: { results: [['One'], ['Two'], ['Three']], total: 3, filtered: 3 } },
            { name: 'total is fractional', response: { results: [], total: 1.5, filtered: 0 } },
        ]) {
            test(`rejects a response when ${name}`, async ({ page }) => {
                await page.evaluate((response) => {
                    $.addEvent('#table', 'error.ui.table', (event) => {
                        $.setDataset(document.body, 'error', event.detail.error.name);
                    });
                    window.startRemote({ getResults: () => response });
                }, response);

                await page.clock.runFor(25);

                await expect(page.locator('body')).toHaveAttribute('data-error', 'TypeError');
                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
            });
        }

        for (const { name, createFailure, error } of [
            {
                name: 'a synchronous throw',
                createFailure: () => () => {
                    throw new Error('failure');
                },
                error: 'Error',
            },
            {
                name: 'a rejected promise',
                createFailure: () => () => Promise.reject(new Error('failure')),
                error: 'Error',
            },
            {
                name: 'invalid results',
                createFailure: () => () => ({ results: [null], total: -1, filtered: 2 }),
                error: 'TypeError',
            },
        ]) {
            test(`handles ${name} and permits retry`, async ({ page }) => {
                // Build the callback in the browser so its errors and promises stay there.
                const failure = await page.evaluateHandle(createFailure);

                await failure.evaluate((fail) => {
                    $.addEvent('#table', 'error.ui.table', (event) => {
                        $.setDataset(document.body, 'error', event.detail.error.name);
                    });
                    let first = true;
                    window.startRemote({
                        getResults() {
                            if (!first) {
                                return { results: [['Recovered']], total: 1, filtered: 1 };
                            }

                            first = false;
                            return fail();
                        },
                    });
                });

                await page.clock.runFor(25);

                await expect(page.locator('body')).toHaveAttribute('data-error', error);
                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');

                await page.evaluate(() => $('#table').table('reload'));

                await page.clock.runFor(25);

                await expect(page.locator('tbody td')).toHaveText('Recovered');
            });
        }
    });

    test.describe('state restoration', () => {
        test('requests restored state once and publishes it before the response', async ({ page }) => {
            await page.evaluate(() => {
                window.states = [];
                $.addEvent('#table', 'statechange.ui.table', (event) => window.states.push(event.detail.state));
                window.startRemote();
            });

            await page.clock.runFor(25);

            const state = await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));
                const state = table.getState();
                state.search = 'Wanted';
                state.filters = [{ column: 0, operator: 'contains', value: 'Wanted' }];
                state.order = [[0, 'desc']];
                state.length = 1;
                state.page = 3;
                table.setState(state);

                return state;
            });

            expect(await page.evaluate(() => window.states)).toEqual([state]);

            await page.clock.runFor(25);

            const requests = await page.evaluate(() => window.requests.map((entry) => entry.request));

            expect(requests).toHaveLength(2);
            expect(requests[1]).toMatchObject({ term: 'Wanted', filters: state.filters, order: { 0: { column: 0, dir: 'desc' } }, offset: 2, limit: 1 });
            await expect(page.locator('body')).toHaveAttribute('data-cancelled', '1');

            await page.evaluate(() => window.requests[1].resolve({ results: [['Wanted']], total: 10, filtered: 4 }));

            await expect(page.locator('tbody td')).toHaveText('Wanted');

            await page.evaluate(() => window.requests[0].resolve({ results: [['Old']], total: 10, filtered: 10 }));

            await expect(page.locator('tbody td')).toHaveText('Wanted');
            expect(await page.evaluate(() => window.states)).toEqual([state]);
        });

        test('publishes a corrected page when restored state exceeds the remote results', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.startRemote();
                window.pages = [];
                $.addEvent('#table', 'statechange.ui.table', (event) => window.pages.push(event.detail.state.page));
                table.setState({ ...table.getState(), page: 5 });
            });

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[0].request.offset)).toBe(8);

            await page.evaluate(() => window.requests[0].resolve({ results: [], total: 3, filtered: 3 }));
            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[1].request.offset)).toBe(2);
            expect(await page.evaluate(() => window.pages)).toEqual([5, 2]);

            await page.evaluate(() => window.requests[1].resolve({ results: [['Last']], total: 3, filtered: 3 }));

            await expect(page.locator('tbody td')).toHaveText('Last');
            expect(await page.evaluate(() => window.pages)).toEqual([5, 2]);
        });

        test('keeps a pending response valid when a snapshot is rejected', async ({ page }) => {
            await page.evaluate(() => window.startRemote());
            await page.clock.runFor(25);

            const error = await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));

                try {
                    table.setState({ ...table.getState(), search: 'Changed', columns: [] });
                } catch (error) {
                    return error.name;
                }
            });

            expect(error).toBe('TypeError');

            await page.evaluate(() => window.requests[0].resolve({ results: [['Original request']], total: 1, filtered: 1 }));

            await expect(page.locator('tbody td')).toHaveText('Original request');
            await expect(page.getByRole('searchbox')).toHaveValue('');
            expect(await page.evaluate(() => window.requests.length)).toBe(1);
        });

        test('stops scheduling when a state listener disposes the table', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.startRemote();
                $.addEvent('#table', 'statechange.ui.table', () => table.dispose());
                table.setState({ ...table.getState(), search: 'Changed' });
            });

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests.length)).toBe(0);
            await expect(page.locator('tbody td')).toHaveText('Original');
        });
    });

    test.describe('filters', () => {
        test('sends copied descriptors with existing request fields and omits cleared filters', async ({ page }) => {
            await page.evaluate(() => {
                window.startRemote({ columns: [{ name: 'score', type: 'number' }] });
                const filters = [{ column: 0, operator: 'between', value: [1, 3] }];
                $('#table').table('setFilters', filters);
                $('#table').table('search', 'score');
                filters[0].value[0] = 100;
            });

            await page.clock.runFor(25);

            const request = await page.evaluate(() => window.requests[0].request);

            expect(request).toEqual({
                columns: { 0: { data: 0, name: 'score', orderable: true, searchable: true } },
                filters: [{ column: 0, operator: 'between', value: [1, 3] }],
                term: 'score',
                order: { 0: { column: 0, dir: 'asc' } },
                offset: 0,
                limit: 2,
            });

            await page.evaluate(() => {
                window.requests[0].request.filters[0].value[0] = 100;
                $('#table').table('reload');
            });

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[1].request.filters)).toEqual(request.filters);

            await page.evaluate(() => $('#table').table('setFilters', []));

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[2].request.filters)).toBeUndefined();
        });

        test('resets the page and ignores an outstanding response after a filter change', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [['A'], ['B']], total: 4, filtered: 4 }));

            await expect(page.locator('tbody td')).toHaveText(['A', 'B']);

            await page.evaluate(() => $('#table').table('page', 2));
            await page.clock.runFor(25);
            await page.evaluate(() => $('#table').table('setFilters', [{ column: 0, operator: 'equals', value: 'Newest' }]));
            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[2].request.offset)).toBe(0);
            await expect(page.locator('body')).toHaveAttribute('data-cancelled', '1');

            await page.evaluate(() => window.requests[2].resolve({ results: [['Newest']], total: 4, filtered: 1 }));

            await expect(page.locator('tbody td')).toHaveText('Newest');

            await page.evaluate(() => window.requests[1].resolve({ results: [['Old'], ['Page']], total: 4, filtered: 4 }));

            await expect(page.locator('tbody td')).toHaveText('Newest');
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
        });

        test('rejects local predicates and keeps a pending request when filters are invalid', async ({ page }) => {
            await page.evaluate(() => window.startRemote());
            await page.clock.runFor(25);

            const errors = await page.evaluate(() => {
                const table = UI.Table.init($.findOne('#table'));
                const errors = [];

                for (const update of [
                    () => table.setRowFilter(() => true),
                    () => table.setFilters([{ column: 2, operator: 'equals', value: 'Invalid' }]),
                ]) {
                    try {
                        update();
                    } catch (error) {
                        errors.push(error.name);
                    }
                }

                window.requests[0].resolve({ results: [['Original request']], total: 1, filtered: 1 });

                return errors;
            });

            expect(errors).toEqual(['TypeError', 'RangeError']);
            await expect(page.locator('tbody td')).toHaveText('Original request');
            await expect(page.locator('body')).toHaveAttribute('data-requests', '1');
        });

        test('uses the no-results message for an empty filtered response', async ({ page }) => {
            await page.evaluate(() => {
                window.startRemote();
                $('#table').table('setFilters', [{ column: 0, operator: 'contains', value: 'Missing' }]);
            });

            await page.clock.runFor(25);
            await page.evaluate(() => window.requests[0].resolve({ results: [], total: 4, filtered: 0 }));

            await expect(page.locator('tbody td')).toHaveText('No results to show');
        });
    });

    test.describe('cancellation', () => {
        test('restores the table before a cancellation hook reinitializes it', async ({ page }) => {
            await page.evaluate(() => window.startRemote({
                getResults() {
                    return {
                        then() {},
                        cancel() {
                            UI.Table.init($.findOne('#table'), { data: [['Reinitialized']] });
                        },
                    };
                },
            }));

            await page.clock.runFor(25);

            await page.evaluate(() => $('#table').table('dispose'));

            await expect(page.locator('tbody td')).toHaveText('Reinitialized');
            await expect(page.locator('.table-responsive')).toHaveCount(1);

            await page.evaluate(() => $('#table').table('dispose'));

            await expect(page.locator('tbody td')).toHaveText('Original');
        });

        test('keeps clear results when an invalidated request resolves late', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);

            await page.evaluate(() => {
                $('#table').table('clear');
                window.requests[0].resolve({ results: [['Late']], total: 1, filtered: 1 });
            });

            await expect(page.locator('tbody td')).toHaveText('No data available');
            await expect(page.getByRole('status')).toHaveText('Showing results 0 to 0 of 0');
        });

        test('ignores obsolete dispatch when cancellation triggers another reload', async ({ page }) => {
            await page.evaluate(() => {
                let first = true;
                const table = window.startRemote({
                    getResults() {
                        if (!first) {
                            return { results: [['Newest']], total: 1, filtered: 1 };
                        }

                        first = false;
                        return {
                            then() {},
                            cancel() {
                                // This reload supersedes the reload that invoked cancellation.
                                table.reload();
                            },
                        };
                    },
                });
            });

            await page.clock.runFor(25);

            await page.evaluate(() => $('#table').table('reload'));

            await page.clock.runFor(25);

            await expect(page.locator('tbody td')).toHaveText('Newest');
            await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
        });

        for (const { name, settle } of [
            {
                name: 'resolution',
                settle: () => window.requests[0].resolve({ results: [['Old']], total: 1, filtered: 1 }),
            },
            {
                name: 'rejection',
                settle: () => window.requests[0].reject(new Error('stale failure')),
            },
        ]) {
            test(`cancels the original request and ignores its late ${name}`, async ({ page }) => {
                await page.evaluate(() => window.startRemote());
                await page.clock.runFor(25);

                await page.evaluate(() => $('#table').table('search', 'new'));

                await expect(page.locator('body')).toHaveAttribute('data-cancelled', '1');

                await page.clock.runFor(25);
                await page.evaluate(() => window.requests[1].resolve({ results: [['New']], total: 1, filtered: 1 }));

                await expect(page.locator('tbody td')).toHaveText('New');

                await page.evaluate(settle);

                await expect(page.locator('tbody td')).toHaveText('New');
                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
            });
        }

        for (const { name, dispatched } of [
            { name: 'a debounced request', dispatched: false },
            { name: 'a dispatched request', dispatched: true },
        ]) {
            test(`disposes ${name}`, async ({ page }) => {
                await page.evaluate(() => window.startRemote());

                if (dispatched) {
                    await page.clock.runFor(25);
                }

                await page.evaluate(() => $('#table').table('dispose'));

                await page.clock.runFor(1000);

                if (dispatched) {
                    await expect(page.locator('body')).toHaveAttribute('data-cancelled', '1');
                    await page.evaluate(() => window.requests[0].resolve({ results: [['Late']], total: 1, filtered: 1 }));
                } else {
                    expect(await page.evaluate(() => window.requests.length)).toBe(0);
                }

                await expect(page.locator('tbody td')).toHaveText('Original');
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('preserves cancellation on a custom thenable', async ({ page }) => {
            await page.evaluate(() => window.startRemote({
                getResults() {
                    return {
                        then() {},
                        cancel() {
                            $.setDataset(document.body, 'cancelled', 'thenable');
                        },
                    };
                },
            }));

            await page.clock.runFor(25);

            await page.evaluate(() => $('#table').table('clear'));

            await expect(page.locator('body')).toHaveAttribute('data-cancelled', 'thenable');
            await expect(page.locator('tbody td')).toHaveText('No data available');
        });
    });

    test.describe('pagination', () => {
        test('edits a loaded remote page and refetches after removing its final row', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);

            await page.evaluate(() => window.requests[0].resolve({ results: [['One'], ['Two']], total: 3, filtered: 3 }));

            await expect(page.locator('tbody td')).toHaveText(['One', 'Two']);

            await page.evaluate(() => $('#table').table('setValue', 0, 0, 'Edited'));

            await expect(page.locator('tbody td')).toHaveText(['Edited', 'Two']);

            await page.evaluate(() => $('#table').table('addRow', ['Added']));

            await expect(page.locator('tbody td')).toHaveText(['Edited', 'Two', 'Added']);

            await page.evaluate(() => $('#table').table('page', 2));

            await page.clock.runFor(25);

            await page.evaluate(() => window.requests[1].resolve({ results: [['Three']], total: 3, filtered: 3 }));

            await expect(page.locator('tbody td')).toHaveText('Three');

            await page.evaluate(() => $('#table').table('removeRow', 0));

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[2].request.offset)).toBe(0);

            await page.evaluate(() => window.requests[2].resolve({ results: [['One'], ['Two']], total: 2, filtered: 2 }));

            await expect(page.locator('tbody td')).toHaveText(['One', 'Two']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 2');
        });

        test('reloads the clamped page when the remote count shrinks', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);

            await page.evaluate(() => window.requests[0].resolve({ results: [['One'], ['Two']], total: 6, filtered: 6 }));

            await expect(page.locator('tbody tr')).toHaveCount(2);

            await page.evaluate(() => $('#table').table('page', 3));

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[1].request.offset)).toBe(4);

            await page.evaluate(() => window.requests[1].resolve({ results: [], total: 2, filtered: 2 }));

            await page.clock.runFor(25);

            expect(await page.evaluate(() => window.requests[2].request.offset)).toBe(0);

            await page.evaluate(() => window.requests[2].resolve({ results: [['One'], ['Two']], total: 2, filtered: 2 }));

            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 2');
        });
    });

    test.describe('debounce', () => {
        test('coalesces rapid searches and resets the offset', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.startRemote();
                table.search('a');
                table.search('ab');
                table.search('abc');
            });

            await page.clock.runFor(19);

            expect(await page.evaluate(() => window.requests.length)).toBe(0);

            await page.clock.runFor(6);

            await expect(page.locator('body')).toHaveAttribute('data-requests', '1');
            expect(await page.evaluate(() => window.requests[0].request.term)).toBe('abc');
            expect(await page.evaluate(() => window.requests[0].request.offset)).toBe(0);
        });
    });
});
