import { expect, test } from '#test';

test.describe('Table remote results', () => {
    test.use({ mockClock: true });
    test.beforeEach(async ({ page }) => {
        await page.evaluate((_) => {
            document.body.innerHTML = '<table id="table"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Original</td></tr></tbody></table>';
            window.requests = [];
            window.startRemote = (options = {}) => UI.Table.init(document.querySelector('#table'), {
                debounce: 20, length: 2,
                getResults(request) {
                    const entry = { request };
                    const pending = new Promise((resolve, reject) => {
                        entry.resolve = resolve; entry.reject = reject;
                    });
                    pending.cancel = () => {
                        document.body.dataset.cancelled = String(Number(document.body.dataset.cancelled || 0) + 1);
                    };
                    window.requests.push(entry);
                    document.body.dataset.requests = String(window.requests.length);
                    return pending;
                }, ...options,
            });
        });
    });

    test.describe('responses', () => {
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
        for (const failure of ['throw', 'reject', 'invalid']) {
            test(`handles ${failure} and permits retry`, async ({ page }) => {
                await page.evaluate((failure) => {
                    $.addEvent('#table', 'error.ui.table', (event) => {
                        document.body.dataset.error = event.detail.error.name;
                    });
                    let first = true;
                    window.startRemote({ getResults() {
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
                    } });
                }, failure);
                await page.clock.runFor(25);
                await expect(page.locator('body')).toHaveAttribute('data-error', /Error/);
                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'false');
                await page.evaluate(() => $('#table').table('reload'));
                await page.clock.runFor(25);
                await expect(page.locator('tbody td')).toHaveText('Recovered');
            });
        }
    });

    test.describe('cancellation', () => {
        test('restores the table before a cancellation hook reinitializes it', async ({ page }) => {
            await page.evaluate(() => window.startRemote({ getResults() {
                return { then() {}, cancel() {
                    UI.Table.init(document.querySelector('#table'), { data: [['Reinitialized']] });
                } };
            } }));
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
            await page.evaluate((_) => {
                $('#table').table('clear');
                window.requests[0].resolve({ results: [['Late']], total: 1, filtered: 1 });
            });
            await expect(page.locator('tbody td')).toHaveText('No data available');
            await expect(page.getByRole('status')).toHaveText('Showing results 0 to 0 of 0');
        });
        test('ignores obsolete dispatch when cancellation triggers another reload', async ({ page }) => {
            await page.evaluate((_) => {
                let first = true;
                const table = window.startRemote({ getResults() {
                    if (!first) {
                        return { results: [['Newest']], total: 1, filtered: 1 };
                    }
                    first = false;
                    return { then() {}, cancel() {
                        table.reload();
                    } };
                } });
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
            await page.evaluate((_) => {
                window.requests[1].resolve({ results: [['New']], total: 1, filtered: 1 });
                window.requests[0].resolve({ results: [['Old']], total: 1, filtered: 1 });
            });
            await expect(page.locator('tbody td')).toHaveText('New');
            await page.evaluate(() => $('#table').table('reload'));
            await page.clock.runFor(25);
            await page.evaluate(() => $('#table').table('reload'));
            await page.clock.runFor(25);
            await page.evaluate((_) => {
                window.requests[2].reject(new Error('stale failure'));
                window.requests[3].resolve({ results: [['Newest']], total: 1, filtered: 1 });
            });
            await expect(page.locator('tbody td')).toHaveText('Newest');
        });
        for (const dispatched of [false, true]) {
            test(`disposes pending work (dispatched=${dispatched})`, async ({ page }) => {
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
            await page.evaluate(() => window.startRemote({ getResults() {
                return { then() {}, cancel() {
                    document.body.dataset.cancelled = 'thenable';
                } };
            } }));
            await page.clock.runFor(25);
            await page.evaluate(() => $('#table').table('clear'));
            await expect(page.locator('body')).toHaveAttribute('data-cancelled', 'thenable');
            await expect(page.locator('tbody td')).toHaveText('No data available');
        });
    });

    test.describe('pagination', () => {
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
            await page.evaluate((_) => {
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
