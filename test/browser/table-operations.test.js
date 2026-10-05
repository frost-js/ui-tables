import { expect, test } from '#test';

test.describe('Table', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body,
                '<table id="table">' +
                '<caption>Scores</caption>' +
                '<thead>' +
                '<tr>' +
                '<th>Name</th>' +
                '<th>Score</th></tr></thead>' +
                '<tbody></tbody></table>',
            );
            window.createTable = (options = {}) => UI.Table.init($.findOne('#table'), {
                data: [['B', 2], ['A', 1], ['A', 3], ['C', 4]],
                length: 2, lengths: [2, 4], debounce: 0, ...options,
            });
        });
    });

    test.describe('#init', () => {
        test('requires a table element rather than a selector or collection', async ({ page }) => {
            expect(await page.evaluate(() => {
                return [null, '#table', [$.findOne('#table')], $.create('div')].map((node) => {
                    try {
                        new UI.Table(node);
                    } catch (error) {
                        return error.name;
                    }
                });
            })).toEqual(['TypeError', 'TypeError', 'TypeError', 'TypeError']);
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
        test('retains the caption as the accessible table name', async ({ page }) => {
            await page.evaluate(() => window.createTable());
            await expect(page.getByRole('table', { name: 'Scores' })).toBeVisible();
        });
        for (const [name, options] of [
            ['columns', { columns: [{}] }],
            ['rows', { data: [null] }],
            ['order', { order: [[4, 'asc']] }],
            ['orderData', { order: [], columns: [{ orderData: [4] }, {}] }],
            ['lengths', { lengths: [0] }],
        ]) {
            test(`rejects invalid ${name} without leaving an instance or wrapper`, async ({ page }) => {
                expect(await page.evaluate((options) => {
                    try {
                        window.createTable(options);
                    } catch (error) {
                        return error.name;
                    }
                }, options)).toMatch(/^(Type|Range)Error$/);
                expect(await page.evaluate(() => $.hasData('#table', 'table'))).toBe(false);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
                await page.evaluate(() => window.createTable());
                await expect(page.locator('tbody tr')).toHaveCount(2);
            });
        }
        test('rejects spanning headings and accepts columns without a heading row', async ({ page }) => {
            expect(await page.evaluate(() => {
                $.setProperty($.findOne('th'), 'colSpan', 2);
                try {
                    window.createTable();
                } catch (error) {
                    return error.name;
                }
            })).toBe('RangeError');
            await page.evaluate(() => {
                $.remove('thead');
                window.createTable({ columns: [{ name: 'Person' }, { name: 'Points' }] });
            });
            await expect(page.locator('th')).toHaveText(['Person', 'Points']);
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
                    table.dispose();
                });
                table.dispose();
                $.triggerEvent(caption, 'click');
                $.triggerEvent(cell, 'click');
                const restored = $.contents(node);
                return {
                    sameContents: restored.length === original.length && restored.every((child, index) => $.isSame(child, original[index])),
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
        test('cancels a pending local search and restores the original busy state', async ({ page }) => {
            await page.clock.install();
            await page.clock.pauseAt(new Date());
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
        test('returns displayed indexes or all original rows as requested', async ({ page }) => {
            await page.evaluate(() => window.createTable());
            expect(await page.evaluate(() => $('#table').table('getColumn', 1))).toEqual([1, 3]);
            expect(await page.evaluate(() => $('#table').table('getColumn', 1, { modified: false }))).toEqual([2, 1, 3, 4]);
        });
    });

    test.describe('#getRow', () => {
        test('returns a shallow copy and rejects an invalid row index', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable();
                const row = table.getRow(0);
                row[0] = 'Changed';
                table.refresh();
            });
            await expect(page.locator('tbody td:first-child')).toHaveText(['A', 'A']);
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
        for (const length of [0, -1, 1.5, Infinity, NaN]) {
            test(`rejects invalid length ${length}`, async ({ page }) => {
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
            await page.evaluate(() => window.createTable({ data: [['toString', 1], ['constructor', 2], ['__proto__', 3]], paging: false }));
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
                    const table = window.createTable({ data: [['A', 'A'], ['A', 'B'], ['X', 'C'], ['A', 'D']], ordering, length: 1 });
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
            await page.evaluate(() => window.createTable({ data: [['Tie', 'keep'], ['Tie', 'drop'], ['Tie', 'keep']], paging: false }).search('keep'));
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

    for (const method of ['setRow', 'setValue']) {
        test.describe(`#${method}`, () => {
            test('reapplies active filtering after an edit', async ({ page }) => {
                await page.evaluate((method) => {
                    const table = window.createTable();
                    table.search('A');
                    if (method === 'setRow') {
                        table.setRow(0, ['Z', 8]);
                    } else {
                        table.setValue(0, 0, 'Z');
                    }
                }, method);
                await expect(page.locator('tbody td')).toHaveText(['A', '3']);
                await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
            });
        });
    }

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

    test.describe('user events', () => {
        test('pages through a long result set using first, previous, numbered and last controls', async ({ page }) => {
            await page.evaluate(() => window.createTable({ data: Array.from({ length: 40 }, (_, i) => [`Row ${i + 1}`, i + 1]), order: [[1, 'asc']] }));
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
        test('debounces typed local search and appends a shift-sort key', async ({ page }) => {
            await page.evaluate(() => window.createTable({ debounce: 20 }));
            await page.getByRole('searchbox').fill('A');
            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
            await expect(page.getByRole('status')).toContainText('of 2 (filtered from 4 total)');
            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });
            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });
            await expect(page.locator('tbody td')).toHaveText(['A', '3', 'A', '1']);
        });
        test('leaves nonorderable headings and disabled features unchanged', async ({ page }) => {
            await page.evaluate(() => window.createTable({ columns: [{ orderable: false }, {}], paging: false, searching: false }));
            await page.getByRole('columnheader', { name: 'Name', exact: true }).click();
            await page.evaluate(() => {
                const table = $('#table').table();
                table.search('missing'); table.page(5); table.length(1);
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

    test.describe('callbacks and rendering', () => {
        for (const callback of ['preDrawCallback', 'headerCallback', 'infoCallback', 'rowCallback', 'createdRow', 'drawCallback']) {
            test(`allows disposal during ${callback}`, async ({ page }) => {
                await page.evaluate((callback) => window.createTable({ [callback]() {
                    this.dispose();
                } }), callback);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }
        for (const callback of ['format', 'createdCell']) {
            test(`allows disposal during column ${callback}`, async ({ page }) => {
                await page.evaluate((callback) => window.createTable({ columns: [{ [callback]() {
                    this.dispose();
                } }, {}] }), callback);
                await expect(page.locator('.table-responsive')).toHaveCount(0);
                await expect(page.locator('caption')).toHaveText('Scores');
            });
        }
        test('allows disposal during sanitization and custom layout rendering', async ({ page }) => {
            await page.evaluate(() => window.createTable({ sanitize(html) {
                $.getData('#table', 'table').dispose();
                return html;
            } }));
            await expect(page.locator('.table-responsive')).toHaveCount(0);
            await page.evaluate(() => {
                UI.Table.layout.stop = function() {
                    this.dispose();
                };
                window.createTable({ layout: { top: 'stop' } });
            });
            await expect(page.locator('.table-responsive')).toHaveCount(0);
            await expect(page.locator('caption')).toHaveText('Scores');
        });
        test('passes the footer and callback indexes in draw order', async ({ page }) => {
            await page.evaluate(() => {
                $.append('#table', $.create('tfoot', {
                    html: '<tr><td colspan="2">Footer</td></tr>',
                }));
                window.calls = [];
                const record = (value) => window.calls.push(value);
                window.createTable({
                    preDrawCallback() {
                        record('pre');
                    },
                    headerCallback(head, data, start, end, indexes) {
                        window.range = [start, end, ...indexes];
                        record('header');
                    },
                    infoCallback(start, end, total, filtered, text) {
                        record('info'); return text;
                    },
                    rowCallback() {
                        record('row');
                    },
                    createdRow() {
                        record('created');
                    },
                    drawCallback() {
                        record('draw');
                    },
                    footerCallback(footer) {
                        record('footer'); $.setText($.findOne('td', footer), 'Updated footer'); this.dispose();
                    },
                });
            });
            expect(await page.evaluate(() => window.calls)).toEqual(['pre', 'header', 'info', 'row', 'created', 'row', 'created', 'draw', 'footer']);
            expect(await page.evaluate(() => window.range)).toEqual([0, 2, 1, 2]);
            await expect(page.locator('tfoot td')).toHaveText('Footer');
            await expect(page.locator('.table-responsive')).toHaveCount(0);
        });
        test('stops an obsolete draw when a callback changes the search', async ({ page }) => {
            await page.evaluate(() => {
                let first = true;
                window.createTable({ headerCallback() {
                    if (first) {
                        first = false; this.search('B');
                    }
                } });
            });
            await expect(page.locator('tbody td')).toHaveText(['B', '2']);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 1 of 1 (filtered from 4 total)');
        });
        test('can cancel a draw and refresh it later', async ({ page }) => {
            await page.evaluate(() => {
                window.cancelDraw = true;
                window.createTable({ preDrawCallback: () => !window.cancelDraw });
            });
            await expect(page.locator('tbody tr')).toHaveCount(0);
            await page.evaluate(() => {
                window.cancelDraw = false; $('#table').table('refresh');
            });
            await expect(page.locator('tbody tr')).toHaveCount(2);
        });
        test('sanitizes formatted HTML and applies cell classes', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [['<strong>Safe</strong><img src=x onerror="window.bad=true">', 1]],
                columns: [{ class: 'cell-name', format: (value) => value }, {}],
            }));
            await expect(page.locator('td.cell-name strong')).toHaveText('Safe');
            await expect(page.locator('[onerror]')).toHaveCount(0);
            expect(await page.evaluate(() => window.bad)).toBeUndefined();
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
    });
});
