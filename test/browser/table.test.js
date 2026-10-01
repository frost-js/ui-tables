import { expect, test } from '#test';

test.describe('Table', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate((_) => {
            document.body.innerHTML =
                '<table id="table1" class="original" aria-describedby="description">' +
                '<thead><tr><th>Name</th><th>Score</th></tr></thead>' +
                '<tbody><tr><td>Charlie</td><td>30</td></tr>' +
                '<tr><td>Alice</td><td>10</td></tr><tr><td>Bob</td><td>20</td></tr></tbody>' +
                '</table><p id="description">Original description</p>' +
                '<table id="table2"><thead><tr><th>Name</th></tr></thead>' +
                '<tbody><tr><td>Dana</td></tr></tbody></table>';
        });
    });

    test.describe('#init', () => {
        for (const { name, init } of [
            { name: 'class', init: () => UI.Table.init(document.querySelector('#table1')) },
            { name: 'QuerySet', init: () => $('#table1').table() },
        ]) {
            test(`creates a table (${name})`, async ({ page }) => {
                const instance = await page.evaluateHandle(init);

                expect(await instance.evaluate((value) => value instanceof UI.Table)).toBe(true);
                expect(await instance.evaluate((value) => $.getData('#table1', 'table') === value)).toBe(true);
                await expect(page.locator('#table1 tbody tr')).toHaveCount(3);
                await expect(page.locator('#table1 tbody td:first-child')).toHaveText(['Alice', 'Bob', 'Charlie']);
                await expect(page.locator('#table1 th').first()).toHaveAttribute('aria-sort', 'ascending');
                await expect(page.getByRole('searchbox')).toBeVisible();
                await expect(page.getByRole('combobox')).toHaveValue('10');
                await expect(page.getByRole('status')).toHaveText('Showing results 1 to 3 of 3');
            });
        }

        test('initializes multiple tables and returns the first instance (QuerySet)', async ({ page }) => {
            expect(await page.evaluate((_) => {
                const first = $('table').table();
                return first === $.getData('#table1', 'table') &&
                    $.getData('#table2', 'table') instanceof UI.Table;
            })).toBe(true);
            await expect(page.locator('.table-responsive')).toHaveCount(2);
            await expect(page.locator('#table2 tbody td')).toHaveText('Dana');
        });

        test('reuses the existing instance', async ({ page }) => {
            expect(await page.evaluate((_) => {
                const node = document.querySelector('#table1');
                const first = UI.Table.init(node, { length: 1 });
                return UI.Table.init(node, { length: 2 }) === first;
            })).toBe(true);
            await expect(page.locator('#table1 tbody tr')).toHaveCount(1);
            await expect(page.locator('.table-responsive')).toHaveCount(1);
        });

        test('exposes the UI node and frozen options without instance internals', async ({ page }) => {
            const instance = await page.evaluateHandle(() => UI.Table.init(document.querySelector('#table1')));

            expect(await instance.evaluate((value) => value.node === document.querySelector('#table1'))).toBe(true);
            expect(await instance.evaluate((value) => Object.isFrozen(value.options))).toBe(true);
            expect(await instance.evaluate((value) => Object.keys(value).length)).toBe(0);
            expect(await instance.evaluate((value) => value.options.length)).toBe(10);
        });

        test('resolves options after data attributes and defaults', async ({ page }) => {
            await page.evaluate((_) => {
                const node = document.querySelector('#table1');
                node.dataset.uiLength = '2';
                UI.Table.init(node, { length: 1 });
                const second = document.querySelector('#table2');
                second.dataset.uiSearching = 'false';
                UI.Table.init(second);
            });
            await expect(page.locator('#table1 tbody tr')).toHaveCount(1);
            await expect(page.getByRole('searchbox')).toHaveCount(1);
        });

        test('keeps instance layout and columns separate from shared defaults', async ({ page }) => {
            await page.evaluate((_) => {
                UI.Table.init(document.querySelector('#table1'), {
                    layout: { top: 'search' },
                    columns: [{ visible: false }, {}],
                });
                UI.Table.init(document.querySelector('#table2'));
            });
            await expect(page.getByRole('combobox')).toHaveCount(1);
            await expect(page.locator('#table1 th')).toHaveCount(1);
            await expect(page.locator('#table2 th')).toHaveText('Name');
            await expect(page.getByRole('status')).toHaveCount(2);
        });

        test('preserves formatted DOM headings and cells with query 5', async ({ page }) => {
            await page.evaluate((_) => {
                document.querySelector('#table2 th').innerHTML = '<strong>Name</strong>';
                document.querySelector('#table2 td').innerHTML = '<em>Dana</em>';
                UI.Table.init(document.querySelector('#table2'));
            });
            await expect(page.locator('#table2 th strong')).toHaveText('Name');
            await expect(page.locator('#table2 td em')).toHaveText('Dana');
        });
    });

    test.describe('#dispose', () => {
        for (const { name, dispose } of [
            { name: 'class', dispose: () => UI.Table.init(document.querySelector('#table1')).dispose() },
            { name: 'QuerySet', dispose: () => $('#table1').table('dispose') },
        ]) {
            test(`restores the original table (${name})`, async ({ page }) => {
                await page.evaluate(() => UI.Table.init(document.querySelector('#table1')));
                await page.evaluate(dispose);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.getByRole('searchbox')).toHaveCount(0);
                await expect(page.locator('#table1')).toHaveClass('original');
                await expect(page.locator('#table1')).toHaveAttribute('aria-describedby', 'description');
                await expect(page.locator('#table1 tbody td:first-child')).toHaveText(['Charlie', 'Alice', 'Bob']);
                expect(await page.evaluate(() => $.hasData('#table1', 'table'))).toBe(false);
            });
        }

        test('can be disposed twice and reinitialized', async ({ page }) => {
            const instance = await page.evaluateHandle(() => UI.Table.init(document.querySelector('#table1')));
            await instance.evaluate((value) => {
                value.dispose();
                value.dispose();
            });
            expect(await instance.evaluate((value) => value.node)).toBeNull();
            expect(await instance.evaluate((value) => value.options)).toBeNull();
            await page.evaluate(() => $('#table1').table());
            await expect(page.locator('.table-responsive')).toHaveCount(1);
            await expect(page.locator('#table1 tbody td:first-child')).toHaveText(['Alice', 'Bob', 'Charlie']);
        });

        test('removes a generated ID and preserves an existing ID', async ({ page }) => {
            await page.evaluate((_) => {
                const node = document.querySelector('#table2');
                node.removeAttribute('id');
                const instance = UI.Table.init(node);
                instance.dispose();
            });
            await expect(page.locator('table').nth(1)).not.toHaveAttribute('id');
            await expect(page.locator('#table1')).toHaveAttribute('id', 'table1');
        });

        test('disposes when query removes the table', async ({ page }) => {
            const instance = await page.evaluateHandle(() => UI.Table.init(document.querySelector('#table1')));
            await page.evaluate(() => $.remove('#table1'));
            expect(await instance.evaluate((value) => value.node)).toBeNull();
            await expect(page.locator('#table1')).toHaveCount(0);
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
    });

    test.describe('#getValue', () => {
        for (const { name, getValue } of [
            { name: 'class', getValue: () => UI.Table.init(document.querySelector('#table1')).getValue(0, 0) },
            { name: 'QuerySet', getValue: () => $('#table1').table('getValue', 0, 0) },
        ]) {
            test(`reads a displayed value (${name})`, async ({ page }) => {
                expect(await page.evaluate(getValue)).toBe('Alice');
            });
        }
    });

    test.describe('events', () => {
        test('registers the instance before initialization and draws the initial rows', async ({ page }) => {
            await page.evaluate((_) => {
                const log = document.createElement('output');
                document.body.append(log);
                $.addEvent('#table1', 'init.ui.table', () => {
                    log.textContent = $.getData('#table1', 'table') instanceof UI.Table ? 'initialized' : 'missing';
                });
                $.addEvent('#table1', 'draw.ui.table', () => {
                    log.textContent += ', drawn';
                });
                UI.Table.init(document.querySelector('#table1'));
            });
            await expect(page.locator('output')).toHaveText('initialized, drawn');
        });
    });

    test.describe('data option', () => {
        test('renders supplied object rows with nested column paths', async ({ page }) => {
            await page.evaluate(() => UI.Table.init(document.querySelector('#table1'), {
                data: [{ name: 'Zoe', result: { score: 8 } }, { name: 'Ada', result: { score: 9 } }],
                columns: [{ data: 'name' }, { data: 'result.score' }],
            }));
            await expect(page.locator('#table1 tbody td')).toHaveText(['Ada', '9', 'Zoe', '8']);
        });

        test('renders a remote response through the bundled component', async ({ page }) => {
            await page.evaluate(() => UI.Table.init(document.querySelector('#table1'), {
                getResults: async () => ({ results: [['Remote', 42]], total: 1, filtered: 1 }),
                debounce: 0,
            }));
            await expect(page.locator('#table1 tbody td')).toHaveText(['Remote', '42']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1');
        });
    });

    test.describe('paging option', () => {
        test('renders all rows when paging is disabled', async ({ page }) => {
            await page.evaluate(() => UI.Table.init(document.querySelector('#table1'), {
                paging: false,
                length: 1,
            }));
            await expect(page.locator('#table1 tbody tr')).toHaveCount(3);
            await expect(page.locator('[data-ui-page]')).toHaveCount(0);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 3 of 3');
        });
    });

    test.describe('callbacks', () => {
        test('passes the information text and heading row to callbacks', async ({ page }) => {
            await page.evaluate(() => UI.Table.init(document.querySelector('#table1'), {
                infoCallback: (start, end, total, filtered, text) => `${text} (${filtered} matches)`,
                headerCallback: (row) => row.setAttribute('data-callback', 'heading'),
            }));
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 3 of 3 (3 matches)');
            await expect(page.locator('#table1 thead tr')).toHaveAttribute('data-callback', 'heading');
        });
    });

    test.describe('layout option', () => {
        test('supports a custom layout with the public component as receiver', async ({ page }) => {
            await page.evaluate((_) => {
                UI.Table.layout.summary = function(container) {
                    container.textContent = this.node.id;
                    container.dataset.testSummary = '';
                };
                UI.Table.init(document.querySelector('#table1'), { layout: { top: 'summary' } });
            });
            await expect(page.locator('[data-test-summary]')).toHaveText('table1');
            await expect(page.getByRole('searchbox')).toHaveCount(0);
            await expect(page.getByRole('status')).toBeVisible();
        });
    });

    test.describe('buttons option', () => {
        test('invokes custom buttons with the public component as receiver', async ({ page }) => {
            await page.evaluate(() => UI.Table.init(document.querySelector('#table1'), {
                buttons: [{
                    text: 'Inspect',
                    callback() {
                        this.node.dataset.selectedValue = this.getValue(0, 0);
                    },
                }],
            }));
            await page.getByRole('button', { name: 'Inspect' }).click();
            await expect(page.locator('#table1')).toHaveAttribute('data-selected-value', 'Alice');
        });

        for (const hideScore of [false, true]) {
            test(`passes displayed rows to the built-in CSV adapter (hidden score=${hideScore})`, async ({ page }) => {
                await page.evaluate((hideScore) => UI.Table.init(document.querySelector('#table1'), {
                    buttons: [{ type: 'csv', title: 'scores' }],
                    columns: [{}, { visible: !hideScore }],
                }), hideScore);
                const downloadPromise = page.waitForEvent('download');
                await page.getByRole('button', { name: 'CSV' }).click();
                const download = await downloadPromise;
                expect(download.suggestedFilename()).toBe('scores.csv');
                const stream = await download.createReadStream();
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                expect(chunks.join('')).toBe(hideScore ?
                    'Name\r\nAlice\r\nBob\r\nCharlie' :
                    'Name,Score\r\nAlice,10\r\nBob,20\r\nCharlie,30');
            });
        }
    });
});
