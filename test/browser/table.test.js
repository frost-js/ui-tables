import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table DOM data', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body,
                '<table id="table1" class="original" aria-describedby="description">' +
                '<thead><tr><th>Name</th><th>Score</th></tr></thead>' +
                '<tbody><tr><td>Charlie</td><td>30</td></tr>' +
                '<tr><td>Alice</td><td>10</td></tr><tr><td>Bob</td><td>20</td></tr></tbody>' +
                '</table><p id="description">Original description</p>' +
                '<table id="table2"><thead><tr><th>Name</th></tr></thead>' +
                '<tbody><tr><td>Dana</td></tr></tbody></table>',
            );
        });
    });

    test.describe('#init', () => {
        for (const { name, init } of [
            { name: 'class', init: () => UI.Table.init($.findOne('#table1')) },
            { name: 'QuerySet', init: () => $('#table1').table() },
        ]) {
            test(`creates and registers a Table (${name})`, async ({ page }) => {
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
            expect(await page.evaluate(() => {
                const first = $('table').table();

                return {
                    returnedFirst: first === $.getData('#table1', 'table'),
                    secondInitialized: $.getData('#table2', 'table') instanceof UI.Table,
                };
            })).toEqual({ returnedFirst: true, secondInitialized: true });
            await expect(page.locator('.table-responsive')).toHaveCount(2);
            await expect(page.locator('#table2 tbody td')).toHaveText('Dana');
        });

        test('reuses the existing instance', async ({ page }) => {
            expect(await page.evaluate(() => {
                const node = $.findOne('#table1');
                const first = UI.Table.init(node, { length: 1 });

                return UI.Table.init(node, { length: 2 }) === first;
            })).toBe(true);
            await expect(page.locator('#table1 tbody tr')).toHaveCount(1);
            await expect(page.locator('.table-responsive')).toHaveCount(1);
        });

        test('exposes the UI node and frozen options', async ({ page }) => {
            const instance = await page.evaluateHandle(() => UI.Table.init($.findOne('#table1')));

            expect(await instance.evaluate((value) => value.node === $.findOne('#table1'))).toBe(true);
            expect(await instance.evaluate((value) => Object.isFrozen(value.options))).toBe(true);
            expect(await instance.evaluate((value) => value.options.length)).toBe(10);
        });

        test('resolves options after data attributes and defaults', async ({ page }) => {
            await page.evaluate(() => {
                const node = $.findOne('#table1');
                $.setDataset(node, 'uiLength', 2);
                UI.Table.init(node, { length: 1 });

                const second = $.findOne('#table2');
                $.setDataset(second, 'uiSearching', false);
                UI.Table.init(second);
            });

            await expect(page.locator('#table1 tbody tr')).toHaveCount(1);
            await expect(page.getByRole('searchbox')).toHaveCount(1);
        });

        test('keeps instance layout and columns separate from shared defaults', async ({ page }) => {
            await page.evaluate(() => {
                UI.Table.init($.findOne('#table1'), {
                    layout: { top: 'search' },
                    columns: [{ visible: false }, {}],
                });
                UI.Table.init($.findOne('#table2'));
            });

            await expect(page.getByRole('combobox')).toHaveCount(1);
            await expect(page.locator('#table1 th')).toHaveCount(1);
            await expect(page.locator('#table2 th')).toHaveText('Name');
            await expect(page.getByRole('status')).toHaveCount(2);
        });

        test('preserves formatted DOM headings and cells', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml($.findOne('#table2 th'), '<strong>Name</strong>');
                $.setHtml($.findOne('#table2 td'), '<em>Dana</em>');
                UI.Table.init($.findOne('#table2'));
            });

            await expect(page.locator('#table2 th strong')).toHaveText('Name');
            await expect(page.locator('#table2 td em')).toHaveText('Dana');
        });
    });

    test.describe('#dispose', () => {
        for (const { name, dispose } of [
            { name: 'class', dispose: () => UI.Table.init($.findOne('#table1')).dispose() },
            { name: 'QuerySet', dispose: () => $('#table1').table('dispose') },
        ]) {
            test(`restores the original table (${name})`, async ({ page }) => {
                await page.evaluate(() => UI.Table.init($.findOne('#table1')));
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
            const instance = await page.evaluateHandle(() => UI.Table.init($.findOne('#table1')));
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
            await page.evaluate(() => {
                const node = $.findOne('#table2');
                $.removeAttribute(node, 'id');
                const instance = UI.Table.init(node);
                instance.dispose();
            });

            await expect(page.locator('table').nth(1)).not.toHaveAttribute('id');
            await expect(page.locator('#table1')).toHaveAttribute('id', 'table1');
        });

        test('disposes when query removes the table', async ({ page }) => {
            const instance = await page.evaluateHandle(() => UI.Table.init($.findOne('#table1')));
            await page.evaluate(() => $.remove('#table1'));

            expect(await instance.evaluate((value) => value.node)).toBeNull();
            await expect(page.locator('#table1')).toHaveCount(0);
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
    });

    test.describe('#getValue', () => {
        for (const { name, getValue } of [
            { name: 'class', getValue: () => UI.Table.init($.findOne('#table1')).getValue(0, 0) },
            { name: 'QuerySet', getValue: () => $('#table1').table('getValue', 0, 0) },
        ]) {
            test(`reads a displayed value (${name})`, async ({ page }) => {
                expect(await page.evaluate(getValue)).toBe('Alice');
            });
        }
    });

    test.describe('events', () => {
        test('registers the instance before initialization and draws the initial rows', async ({ page }) => {
            await page.evaluate(() => {
                const log = $.create('output');
                $.append(document.body, log);
                $.addEvent('#table1', 'init.ui.table', () => {
                    $.setText(log, $.getData('#table1', 'table') instanceof UI.Table ? 'initialized' : 'missing');
                });
                $.addEvent('#table1', 'draw.ui.table', () => {
                    $.setText(log, `${$.getText(log)}, drawn`);
                });
                UI.Table.init($.findOne('#table1'));
            });

            await expect(page.locator('output')).toHaveText('initialized, drawn');
        });
    });
});

test.describe('Table supplied data', () => {
    test.beforeEach(setupTable);

    test.describe('#init', () => {
        test('retains the caption as the accessible table name', async ({ page }) => {
            await page.evaluate(() => window.createTable());

            await expect(page.getByRole('table', { name: 'Scores' })).toBeVisible();
        });

        test('accepts columns without a heading row', async ({ page }) => {
            await page.evaluate(() => {
                $.remove('thead');
                window.createTable({ columns: [{ name: 'Person' }, { name: 'Points' }] });
            });

            await expect(page.locator('th')).toHaveText(['Person', 'Points']);
        });

        test.describe('failed initialization', () => {
            for (const { name, getNode } of [
                { name: 'null', getNode: () => null },
                { name: 'a selector', getNode: () => '#table' },
                { name: 'a collection', getNode: () => [$.findOne('#table')] },
                { name: 'a non-table element', getNode: () => $.create('div') },
            ]) {
                test(`rejects ${name} as the constructor node`, async ({ page }) => {
                    const node = await page.evaluateHandle(getNode);

                    const error = await node.evaluate((node) => {
                        try {
                            new UI.Table(node);
                        } catch (error) {
                            return error.name;
                        }
                    });

                    expect(error).toBe('TypeError');
                    expect(await page.evaluate(() => $.hasData('#table', 'table'))).toBe(false);
                    await expect(page.locator('.table-responsive')).toHaveCount(0);
                });
            }

            test('rejects non-element arguments without disturbing an existing instance', async ({ page }) => {
                const state = await page.evaluate(() => {
                    const node = $.findOne('#table');
                    const instance = UI.Table.init(node);
                    const html = $.getHtml(document.body);
                    const errors = [];

                    for (const [name, argument] of [
                        ['null', null],
                        ['undefined', undefined],
                        ['selector', '#table'],
                        ['malformed selector', '['],
                        ['array', [node]],
                        ['QuerySet', $('#table')],
                        ['document', document],
                        ['text node', document.createTextNode('text')],
                    ]) {
                        for (const [method, init] of [
                            ['constructor', (node) => new UI.Table(node)],
                            ['init', (node) => UI.Table.init(node)],
                        ]) {
                            let message = null;

                            try {
                                init(argument);
                            } catch (error) {
                                message = `${error.name}: ${error.message}`;
                            }

                            errors.push({ name, method, message });
                        }
                    }

                    return {
                        errors,
                        unchanged: $.getHtml(document.body) === html &&
                            $.getData(node, UI.Table.DATA_KEY) === instance,
                    };
                });

                for (const { name, method, message } of state.errors) {
                    expect(message, `${name} (${method})`).toBe('TypeError: Table must be created on a table element.');
                }
                expect(state.unchanged).toBe(true);
            });

            test('preserves untouched attributes when capturing initial state throws', async ({ page }) => {
                const state = await page.evaluate(() => {
                    const node = $.findOne('#table');
                    $.setAttribute(node, {
                        'class': 'original',
                        'aria-controls': 'original-controls',
                        'aria-expanded': 'false',
                        'aria-describedby': 'original-description',
                        'aria-busy': 'false',
                    });
                    const html = node.outerHTML;
                    const getAttribute = Element.prototype.getAttribute;
                    const failure = new Error('Cannot capture attributes');
                    let originalError = false;

                    Element.prototype.getAttribute = function(name) {
                        if (this === node && name === 'aria-describedby') {
                            throw failure;
                        }

                        return getAttribute.call(this, name);
                    };

                    try {
                        UI.Table.init(node);
                    } catch (error) {
                        originalError = error === failure;
                    } finally {
                        Element.prototype.getAttribute = getAttribute;
                    }

                    return {
                        originalError,
                        registered: $.hasData(node, UI.Table.DATA_KEY),
                        unchanged: node.outerHTML === html,
                    };
                });

                expect(state).toEqual({ originalError: true, registered: false, unchanged: true });
            });

            for (const { name, options, error } of [
                { name: 'columns', options: { columns: [{}] }, error: 'RangeError' },
                { name: 'rows', options: { data: [null] }, error: 'TypeError' },
                { name: 'order', options: { order: [[4, 'asc']] }, error: 'RangeError' },
                { name: 'orderData', options: { order: [], columns: [{ orderData: [4] }, {}] }, error: 'RangeError' },
                { name: 'lengths', options: { lengths: [0] }, error: 'RangeError' },
            ]) {
                test(`rejects invalid ${name} without leaving an instance or wrapper`, async ({ page }) => {
                    expect(await page.evaluate((options) => {
                        try {
                            window.createTable(options);
                        } catch (error) {
                            return error.name;
                        }
                    }, options)).toBe(error);
                    expect(await page.evaluate(() => $.hasData('#table', 'table'))).toBe(false);
                    await expect(page.locator('.table-responsive')).toHaveCount(0);
                    await expect(page.locator('caption')).toHaveText('Scores');

                    await page.evaluate(() => window.createTable());

                    await expect(page.locator('tbody tr')).toHaveCount(2);
                });
            }

            test('rejects spanning headings', async ({ page }) => {
                expect(await page.evaluate(() => {
                    $.setProperty($.findOne('th'), 'colSpan', 2);
                    try {
                        window.createTable();
                    } catch (error) {
                        return error.name;
                    }
                })).toBe('RangeError');

                expect(await page.evaluate(() => $.hasData('#table', 'table'))).toBe(false);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        });
    });

    test.describe('#dispose', () => {
        test('preserves original contents and query state while cleaning generated cells', async ({ page }) => {
            expect(await page.evaluate(() => {
                const node = $.findOne('#table');
                const caption = $.findOne('caption', node);

                $.prepend(node, [$.createText('\n'), $.createComment('Original table')]);
                const original = $.contents(node);
                let originalEvents = 0;
                let generatedEvents = 0;
                let removals = 0;

                $.setData(caption, 'marker', 'original');
                $.addEvent(caption, 'click', () => originalEvents++);

                const table = window.createTable();
                const cell = $.findOne('tbody td', node);

                $.setData(cell, 'marker', 'generated');
                $.addEvent(cell, 'click', () => generatedEvents++);
                $.addEvent(cell, 'remove', () => {
                    removals++;
                    // Cleanup must tolerate another dispose call from a removal listener.
                    table.dispose();
                });

                table.dispose();
                $.triggerEvent(caption, 'click');
                $.triggerEvent(cell, 'click');

                const restored = $.contents(node);

                return {
                    sameContents: restored.length === original.length &&
                        restored.every((child, index) => $.isSame(child, original[index])),
                    originalData: $.getData(caption, 'marker'),
                    generatedData: $.hasData(cell, 'marker'),
                    originalEvents,
                    generatedEvents,
                    removals,
                    disposed: table.node === null,
                };
            })).toEqual({
                sameContents: true,
                originalData: 'original',
                generatedData: false,
                originalEvents: 1,
                generatedEvents: 0,
                removals: 1,
                disposed: true,
            });

            await page.evaluate(() => window.createTable());

            await expect(page.locator('tbody tr')).toHaveCount(2);
        });

        test('supports omitted controls and restores original DOM nodes and listeners', async ({ page }) => {
            await page.evaluate(() => {
                const caption = $.findOne('caption');
                caption.addEventListener('click', () => {
                    $.setText(caption, 'Original listener');
                });
                const table = window.createTable({ layout: { top: '', bottom: '' } });
                table.search('A');
                table.page(2);
                table.dispose();
            });

            await page.locator('caption').click();

            await expect(page.locator('caption')).toHaveText('Original listener');
        });

        test.describe('pending searches', () => {
            test.use({ mockClock: true });

            test('cancels a pending local search and restores the original busy state', async ({ page }) => {
                await page.evaluate(() => {
                    $.setAttribute($.findOne('#table'), 'aria-busy', 'true');
                    window.createTable({ debounce: 100 });
                });

                await page.getByRole('searchbox').fill('A');

                await page.evaluate(() => $('#table').table('dispose'));

                await page.clock.runFor(200);

                await expect(page.locator('#table')).toHaveAttribute('aria-busy', 'true');
                await expect(page.locator('tbody tr')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        });
    });

    test.describe('events', () => {
        for (const event of ['init', 'processing', 'processed', 'preDraw', 'draw']) {
            test(`allows disposal during ${event}`, async ({ page }) => {
                await page.evaluate((event) => {
                    $.addEvent('#table', `${event}.ui.table`, () => $.getData('#table', 'table').dispose());
                    window.createTable();
                }, event);

                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }
    });
});
