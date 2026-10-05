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

        for (const { name, failure, error } of [
            { name: 'a synchronous throw', failure: 'throw', error: 'Error' },
            { name: 'a rejected promise', failure: 'reject', error: 'Error' },
            { name: 'invalid results', failure: 'invalid', error: 'TypeError' },
        ]) {
            test(`handles ${name} and permits retry`, async ({ page }) => {
                await page.evaluate((failure) => {
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
                            if (failure === 'throw') {
                                throw new Error('failure');
                            }
                            if (failure === 'reject') {
                                return Promise.reject(new Error('failure'));
                            }

                            return { results: [null], total: -1, filtered: 2 };
                        },
                    });
                }, failure);

                await page.clock.runFor(25);

                await expect(page.locator('body')).toHaveAttribute('data-error', error);
                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');

                await page.evaluate(() => $('#table').table('reload'));

                await page.clock.runFor(25);

                await expect(page.locator('tbody td')).toHaveText('Recovered');
            });
        }
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

        test('cancels the original request and ignores late resolutions and rejections', async ({ page }) => {
            await page.evaluate(() => window.startRemote());

            await page.clock.runFor(25);

            await page.evaluate(() => $('#table').table('search', 'new'));

            await expect(page.locator('body')).toHaveAttribute('data-cancelled', '1');

            await page.clock.runFor(25);

            await page.evaluate(() => {
                window.requests[1].resolve({ results: [['New']], total: 1, filtered: 1 });
                window.requests[0].resolve({ results: [['Old']], total: 1, filtered: 1 });
            });

            await expect(page.locator('tbody td')).toHaveText('New');

            await page.evaluate(() => $('#table').table('reload'));

            await page.clock.runFor(25);

            await page.evaluate(() => $('#table').table('reload'));

            await page.clock.runFor(25);

            await page.evaluate(() => {
                window.requests[2].reject(new Error('stale failure'));
                window.requests[3].resolve({ results: [['Newest']], total: 1, filtered: 1 });
            });

            await expect(page.locator('tbody td')).toHaveText('Newest');
        });

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
