import { expect, test } from '#test';
import { setupDomTable, setupTable } from '../setup/table.js';

test.describe('Table', () => {
    test.beforeEach(setupTable);

    test.describe('#init', () => {
        test.describe('DOM data', () => {
            test.beforeEach(setupDomTable);

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
                })).toEqual({
                    returnedFirst: true,
                    secondInitialized: true,
                });
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

        test.describe('data option', () => {
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
                        html,
                        sameInstance: $.getData(node, UI.Table.DATA_KEY) === instance,
                    };
                });

                for (const { name, method, message } of state.errors) {
                    expect(message, `${name} (${method})`).toBe('TypeError: Table must be created on a table element.');
                }

                expect(state.sameInstance).toBe(true);
                await expect(page.locator('body')).toHaveJSProperty('innerHTML', state.html);
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
                        html,
                    };
                });

                expect(state.originalError).toBe(true);
                expect(state.registered).toBe(false);
                await expect(page.locator('#table')).toHaveJSProperty('outerHTML', state.html);
            });

            for (const { name, options, error } of [
                { name: 'columns', options: { columns: [{}] }, error: 'RangeError' },
                { name: 'rows', options: { data: [null] }, error: 'TypeError' },
                { name: 'order', options: { order: [[4, 'asc']] }, error: 'RangeError' },
                {
                    name: 'orderData',
                    options: { order: [], columns: [{ orderData: [4] }, {}] },
                    error: 'RangeError',
                },
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
        test.describe('DOM data', () => {
            test.beforeEach(setupDomTable);

            for (const { name, dispose } of [
                { name: 'class', dispose: () => UI.Table.init($.findOne('#table1')).dispose() },
                { name: 'QuerySet', dispose: () => $('#table1').table('dispose') },
            ]) {
                test(`restores the original table (${name})`, async ({ page }) => {
                    await page.evaluate(() => {
                        UI.Table.init($.findOne('#table1'));
                        $.addClass('#table1', 'application');
                    });
                    await page.evaluate(dispose);

                    await expect(page.locator('.table-responsive')).toHaveCount(0);
                    await expect(page.getByRole('searchbox')).toHaveCount(0);
                    await expect(page.locator('#table1')).toHaveClass('original application');
                    await expect(page.locator('#table1')).toHaveAttribute('aria-describedby', 'description');
                    await expect(page.locator('#table1 tbody td:first-child')).toHaveText(['Charlie', 'Alice', 'Bob']);
                    expect(await page.evaluate(() => $.hasData('#table1', 'table'))).toBe(false);
                });
            }

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

            test('disposes when query removes the table', async ({ page }) => {
                const instance = await page.evaluateHandle(() => UI.Table.init($.findOne('#table1')));

                await page.evaluate(() => $.remove('#table1'));

                expect(await instance.evaluate((value) => value.node)).toBeNull();
                await expect(page.locator('#table1')).toHaveCount(0);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        });

        test.describe('data option', () => {
            test('preserves original contents and query state while cleaning generated cells', async ({ page }) => {
                const result = await page.evaluate(() => {
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
                });

                expect(result.sameContents).toBe(true);
                expect(result.originalData).toBe('original');
                expect(result.generatedData).toBe(false);
                expect(result.originalEvents).toBe(1);
                expect(result.generatedEvents).toBe(0);
                expect(result.removals).toBe(1);
                expect(result.disposed).toBe(true);

                await page.evaluate(() => window.createTable());

                await expect(page.locator('tbody tr')).toHaveCount(2);
            });

            test('supports omitted controls and restores original DOM nodes and listeners', async ({ page }) => {
                await page.evaluate(() => {
                    const caption = $.findOne('caption');

                    caption.addEventListener('click', () => {
                        $.setText(caption, 'Original listener');
                    });

                    const table = window.createTable({
                        layout: { top: '', bottom: '' },
                    });

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
    });

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

    test.describe('#getValue', () => {
        test.describe('DOM data', () => {
            test.beforeEach(setupDomTable);

            for (const { name, getValue } of [
                { name: 'class', getValue: () => UI.Table.init($.findOne('#table1')).getValue(0, 0) },
                { name: 'QuerySet', getValue: () => $('#table1').table('getValue', 0, 0) },
            ]) {
                test(`reads a displayed value (${name})`, async ({ page }) => {
                    expect(await page.evaluate(getValue)).toBe('Alice');
                });
            }
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
            await page.evaluate(() => window.createTable({
                order: [],
                columns: [{ orderData: [1] }, {}],
            }));

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

    test.describe('#refresh', () => {
        test('can cancel a draw and refresh it later', async ({ page }) => {
            await page.evaluate(() => {
                window.cancelDraw = true;
                window.createTable({
                    preDrawCallback: () => !window.cancelDraw,
                });
            });

            await expect(page.locator('tbody tr')).toHaveCount(0);

            await page.evaluate(() => {
                window.cancelDraw = false;
                $('#table').table('refresh');
            });

            await expect(page.locator('tbody tr')).toHaveCount(2);
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

    test.describe('events', () => {
        test.describe('DOM data', () => {
            test.beforeEach(setupDomTable);

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

        test.describe('data option', () => {
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
});
