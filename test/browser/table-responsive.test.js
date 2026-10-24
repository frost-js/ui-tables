import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table responsive details', () => {
    test.beforeEach(setupTable);
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml('thead tr', '<th>Name</th><th>Team</th><th>Score</th>');

            const host = $.create('div', { attributes: { id: 'host' }, style: { width: '900px' } });

            $.before('#table', host);
            $.append(host, $.findOne('#table'));
            $.append(document.head, $.create('style', {
                text: '#table th[data-ui-index], #table td.test-cell { min-width: 160px; }',
            }));
            window.createResponsive = (options = {}) => window.createTable({
                data: [['Alice', 'Engineering', 90], ['Bob', 'Design', 80], ['Cara', 'Support', 70]],
                columns: [
                    { class: 'test-cell', responsivePriority: null },
                    { class: 'test-cell', responsivePriority: 1 },
                    { class: 'test-cell', responsivePriority: 2 },
                ],
                responsive: true,
                rowId: 0,
                ...options,
            });
        });
    });

    test.describe('configuration and layout', () => {
        for (const priority of [-1, 1.5, '1', true, Number.MAX_SAFE_INTEGER + 1]) {
            test(`rejects invalid priority ${JSON.stringify(priority)}`, async ({ page }) => {
                const error = await page.evaluate((priority) => {
                    try {
                        window.createResponsive({ columns: [{ responsivePriority: priority }, {}, {}] });
                    } catch (error) {
                        return error.name;
                    }
                }, priority);

                expect(error).toBe('TypeError');
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('requires a boolean option and leaves responsive behavior disabled by default', async ({ page }) => {
            const result = await page.evaluate(() => {
                let error;

                try {
                    window.createResponsive({ responsive: 'auto' });
                } catch (caught) {
                    error = caught.name;
                }

                $.setStyle('#host', { width: '240px' });

                const table = window.createResponsive({ responsive: false });

                return {
                    error,
                    columns: table.getState().columns.length,
                };
            });

            expect(result.error).toBe('TypeError');
            expect(result.columns).toBe(3);
            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name', 'Team', 'Score']);
            await expect(page.getByRole('button', { name: /details for row/ })).toHaveCount(0);
        });

        test('collapses lower priority columns as the container narrows, preserving state and exports', async ({ page }) => {
            await page.evaluate(() => {
                window.table = window.createResponsive();
                window.before = window.table.getState();
                window.events = 0;
                $.addEvent('#table', 'draw.ui.table statechange.ui.table processing.ui.table', () => window.events++);
            });
            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name', 'Team', 'Score']);
            await page.evaluate(() => $.setStyle('#host', { width: '430px' }));
            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name', 'Team']);
            await page.evaluate(() => $.setStyle('#host', { width: '240px' }));
            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name']);

            const result = await page.evaluate(() => ({
                state: window.table.getState(),
                before: window.before,
                events: window.events,
                exported: window.table.getExportData(),
                data: window.table.getData(),
                info: window.table.info(),
            }));

            expect(result.state).toEqual(result.before);
            expect(result.events).toBe(0);
            expect(result.exported).toEqual({
                headings: ['Name', 'Team', 'Score'],
                rows: [['Alice', 'Engineering', 90], ['Bob', 'Design', 80]],
            });
            expect(result.data).toEqual(result.exported.rows);
            expect(result.info).toEqual({
                start: 0,
                end: 2,
                total: 3,
                filtered: 3,
            });
            await page.evaluate(() => $.setStyle('#host', { width: '900px' }));
            await expect(page.locator('th[data-ui-index]:visible')).toHaveCount(3);
            await expect(page.getByRole('button', { name: /details for row/ })).toHaveCount(0);
        });

        for (const { priorities, expected } of [
            { priorities: [null, 10, 1], expected: ['Name', 'Score'] },
            { priorities: [1000, 1000, 1000], expected: ['Name', 'Team'] },
            { priorities: [null, null, null], expected: ['Name', 'Team', 'Score'] },
        ]) {
            test(`respects priority order ${JSON.stringify(priorities)}`, async ({ page }) => {
                await page.evaluate((priorities) => {
                    $.setStyle('#host', { width: '430px' });
                    window.createResponsive({
                        columns: priorities.map((responsivePriority) => ({ class: 'test-cell', responsivePriority })),
                    });
                }, priorities);

                await expect(page.locator('th[data-ui-index]:visible')).toHaveText(expected);
            });
        }

        test('retains one column and scrolling when required columns cannot fit', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '100px' });
                window.createResponsive({
                    columns: [{ class: 'test-cell' }, { class: 'test-cell' }, { class: 'test-cell' }],
                });
            });

            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name']);
            expect(await page.locator('.table-responsive').evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
        });

        test('waits for a hidden container to gain width and supports RTL layout', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px', display: 'none' });
                $.setAttribute('#host', { dir: 'rtl' });
                window.createResponsive();
            });
            await expect(page.locator('th[data-ui-index][hidden]')).toHaveCount(0);
            await page.evaluate(() => $.setStyle('#host', { display: 'block' }));
            await expect(page.locator('th[data-ui-index]:visible')).toHaveText(['Name']);
            await expect(page.locator('#table')).toHaveCSS('direction', 'rtl');
        });
    });

    test.describe('disclosures', () => {
        test('renders sanitized display values with text labels and no extra data callbacks', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('thead tr', '<th>Name</th><th><b>Team &amp; group</b></th><th> </th>');
                $.setStyle('#host', { width: '240px' });
                window.calls = { row: 0, cell: 0, created: 0, draw: 0 };
                window.table = window.createResponsive({
                    columns: [
                        { class: 'test-cell', responsivePriority: null },
                        { class: 'test-cell' },
                        {
                            class: 'test-cell',
                            render(value, { purpose }) {
                                return purpose === 'display' ? `<strong>${value}</strong><img src="data:," onerror="window.unsafe = true">` : value;
                            },
                            createdCell() {
                                window.calls.cell++;
                            },
                        },
                    ],
                    rowCallback() {
                        window.calls.row++;
                    },
                    createdRow() {
                        window.calls.created++;
                    },
                    drawCallback() {
                        window.calls.draw++;
                    },
                });
                window.before = { ...window.calls };
            });

            const button = page.getByRole('button', { name: /details for row Alice$/ });

            await button.focus();
            await button.press('Enter');
            await expect(button).toBeFocused();
            await expect(button).toHaveAttribute('aria-expanded', 'true');

            const detail = page.locator('tr.table-details');

            await expect(detail.locator('dt')).toHaveText(['Team & group', 'Column 3']);
            await expect(detail.locator('dd strong')).toHaveText('90');
            await expect(detail.locator('dt b, [onerror]')).toHaveCount(0);
            await expect(button).toHaveAttribute('aria-controls', await detail.getAttribute('id'));

            const result = await page.evaluate(() => ({ calls: window.calls, before: window.before, unsafe: Boolean(window.unsafe) }));

            expect(result.calls).toEqual(result.before);
            expect(result.unsafe).toBe(false);
            await button.press('Space');
            await expect(button).toBeFocused();
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await expect(detail).toHaveCount(0);
        });

        test('keeps selection independent and excludes user-hidden columns from details', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({
                    selection: 'multiple',
                    buttons: [{ type: 'columns' }],
                });
                window.table.setSelectedIds(['Alice']);
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-details td')).toHaveAttribute('colspan', '3');
            await page.getByRole('button', { name: 'Columns', exact: true }).click();

            const picker = page.getByRole('group', { name: 'Columns' });

            await expect(picker.getByRole('checkbox', { name: 'Team', exact: true })).toBeChecked();
            await picker.getByRole('checkbox', { name: 'Team', exact: true }).uncheck();
            await expect(page.locator('.table-details dt')).toHaveText(['Score']);
            expect(await page.evaluate(() => window.table.getSelectedIds())).toEqual(['Alice']);
            expect(await page.evaluate(() => window.table.getExportData().headings)).toEqual(['Name', 'Score']);
            await page.evaluate(() => {
                window.table.hideColumn(0);
                window.table.hideColumn(2);
            });
            await expect(page.locator('.table-details')).toHaveCount(0);
            await expect(page.getByRole('button', { name: /details for row/ })).toHaveCount(0);
        });

        test('retains expansion for IDs still on the page, but discards it when they leave', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({ length: 3 });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await page.evaluate(() => {
                window.table.order([[0, 'desc']]);
                window.table.setRowById('Alice', ['Alice', 'Updated team', 95]);
            });
            await expect(page.getByRole('button', { name: 'Hide details for row Alice', exact: true })).toHaveAttribute('aria-expanded', 'true');
            await expect(page.locator('.table-details dd')).toHaveText(['Updated team', '95']);
            await page.evaluate(() => {
                window.table.length(1);
                window.table.page(3);
            });
            await expect(page.getByRole('button', { name: 'Show details for row Alice', exact: true })).toHaveAttribute('aria-expanded', 'false');
            await expect(page.locator('.table-details')).toHaveCount(0);
        });

        test('clears positional expansion on redraw without stable IDs', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({ rowId: null });
            });
            await page.getByRole('button', { name: 'Show details for row 1', exact: true }).click();
            await expect(page.locator('.table-details')).toHaveCount(1);
            await page.evaluate(() => window.table.refresh());
            await expect(page.locator('.table-details')).toHaveCount(0);
        });

        test('preserves disclosure focus during collapse changes and moves it to the row when details disappear', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive();
            });

            const button = page.getByRole('button', { name: /details for row Alice$/ });

            await button.click();
            await page.evaluate(() => $.setStyle('#host', { width: '430px' }));
            await expect(page.locator('.table-details dt')).toHaveText(['Score']);
            await expect(page.getByRole('button', { name: 'Hide details for row Alice', exact: true })).toBeFocused();
            await page.evaluate(() => $.setStyle('#host', { width: '900px' }));
            await expect(page.locator('.table-details')).toHaveCount(0);
            await expect(page.locator('tbody tr').first()).toBeFocused();
            await page.evaluate(() => $.setStyle('#host', { width: '240px' }));
            await expect(page.getByRole('button', { name: 'Show details for row Alice', exact: true })).toHaveAttribute('aria-expanded', 'false');
        });

        test('wraps long detail text without losing the complete value', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.createResponsive({ data: [['Alice', 'x'.repeat(500), 90]] });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();

            const value = page.locator('.table-details dd').first();

            await expect(value).toHaveText('x'.repeat(500));
            await expect(value).toHaveCSS('overflow-wrap', 'anywhere');
            expect(await value.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        });

        test('aligns empty-result and footer spans with selection and collapsed columns', async ({ page }) => {
            await page.evaluate(() => {
                $.append('#table', $.create('tfoot', { html: '<tr><td colspan="2">Summary</td><td>240</td></tr>' }));
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({ selection: 'multiple' });
                window.table.search('missing');
            });
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '3');
            await expect(page.locator('tfoot td').nth(2)).toHaveAttribute('colspan', '1');
            await expect(page.locator('tfoot td').last()).toBeHidden();
            await page.evaluate(() => $.setStyle('#host', { width: '900px' }));
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '4');
            await expect(page.locator('tfoot td').nth(2)).toHaveAttribute('colspan', '2');
            await expect(page.locator('tfoot td').last()).toBeVisible();
        });
    });

    test.describe('custom renderers', () => {
        for (const { name, renderDetails } of [
            { name: 'boolean', renderDetails: false },
            { name: 'string', renderDetails: 'html' },
            { name: 'number', renderDetails: 42 },
            { name: 'object', renderDetails: {} },
        ]) {
            test(`rejects a ${name} renderer`, async ({ page }) => {
                const error = await page.evaluate((renderDetails) => {
                    try {
                        window.createResponsive({ renderDetails });
                    } catch (error) {
                        return error.name;
                    }
                }, renderDetails);

                expect(error).toBe('TypeError');
                await expect(page.locator('.table-responsive')).toHaveCount(0);
            });
        }

        test('provides source indexes and collapsed display metadata and sanitizes custom output', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                $.setHtml('thead th:nth-child(2)', '<b>Team &amp; group</b>');
                window.calls = [];
                window.table = window.createResponsive({
                    data: [['Bob', 'Design', 80], ['Alice', 'Engineering', 90]],
                    order: [[2, 'desc']],
                    columns: [
                        { class: 'test-cell', responsivePriority: null },
                        { class: 'test-cell', responsivePriority: 1 },
                        {
                            class: 'test-cell',
                            responsivePriority: 2,
                            format: (value) => `<strong>${value}</strong>`,
                        },
                    ],
                    renderDetails(row, context) {
                        window.calls.push({ row, ...context, receiver: this === window.table });

                        return `<div>${context.columns.map(({ html }) => html).join(' ')}<img src="data:," onerror="window.unsafe = true"></div>`;
                    },
                });
            });
            expect(await page.evaluate(() => window.calls)).toEqual([]);
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-details div')).toHaveText('Engineering 90');
            await expect(page.locator('.table-details strong')).toHaveText('90');
            await expect(page.locator('.table-details [onerror], .table-details dl')).toHaveCount(0);
            expect(await page.evaluate(() => window.calls)).toEqual([{
                row: ['Alice', 'Engineering', 90],
                rowIndex: 1,
                receiver: true,
                columns: [
                    { column: 1, data: 1, title: 'Team & group', html: 'Engineering' },
                    { column: 2, data: 2, title: 'Score', html: '<strong>90</strong>' },
                ],
            }]);
            await page.evaluate(() => window.table.hideColumn(1));
            expect(await page.evaluate(() => window.calls.at(-1).columns)).toEqual([
                { column: 2, data: 2, title: 'Score', html: '<strong>90</strong>' },
            ]);
            await expect(page.locator('.table-details td')).toHaveAttribute('colspan', '2');
        });

        test('refreshes open custom details for data and collapsed columns only', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.calls = 0;
                window.table = window.createResponsive({
                    renderDetails(row, { columns }) {
                        window.calls++;

                        return `<p>${columns.map(({ html }) => html).join(' / ')}</p>`;
                    },
                });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-details p')).toHaveText('Engineering / 90');
            await page.evaluate(() => window.table.setRowById('Alice', ['Alice', 'New team', 95]));
            await expect(page.locator('.table-details p')).toHaveText('New team / 95');
            await page.evaluate(() => $.setStyle('#host', { width: '430px' }));
            await expect(page.locator('.table-details p')).toHaveText('95');

            const calls = await page.evaluate(() => window.calls);

            await page.evaluate(async () => {
                $.setStyle('#host', { width: '440px' });
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            expect(await page.evaluate(() => window.calls)).toBe(calls);
            await page.getByRole('button', { name: 'Hide details for row Alice', exact: true }).click();
            await page.evaluate(() => window.table.setRowById('Alice', ['Alice', 'Closed', 96]));
            expect(await page.evaluate(() => window.calls)).toBe(calls);
            await expect(page.locator('.table-details')).toHaveCount(0);
        });

        test('allows empty HTML and skips rendering when responsive behavior is disabled', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.calls = 0;
                window.table = window.createResponsive({
                    responsive: false,
                    renderDetails() {
                        window.calls++;

                        return '';
                    },
                });
            });
            expect(await page.evaluate(() => window.calls)).toBe(0);
            await page.evaluate(() => {
                window.table.dispose();
                window.table = window.createResponsive({
                    renderDetails: () => '',
                });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-details td')).toBeEmpty();
        });

        test('abandons custom output when the renderer replaces the data', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({
                    renderDetails() {
                        this.setData([['Newer', 'New team', 1]]);

                        return '<p>Obsolete</p>';
                    },
                });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Show details for row Newer', exact: true })).toBeVisible();
            await expect(page.locator('.table-details')).toHaveCount(0);
        });

        test('abandons custom output when its sanitizer disposes the table', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });
                window.table = window.createResponsive({
                    renderDetails: () => '<p>Custom</p>',
                    sanitize(html) {
                        if (html === '<p>Custom</p>') window.table.dispose();

                        return $.sanitize(html);
                    },
                });
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-responsive, .table-details')).toHaveCount(0);
        });

        test.describe('invalid output', () => {
            test.use({ expectedBrowserErrors: ['Details renderer must return an HTML string.'] });

            for (const output of ['null', 'node', 'promise']) {
                test(`rejects ${output}`, async ({ page }) => {
                    await page.evaluate((output) => {
                        $.setStyle('#host', { width: '240px' });
                        window.createResponsive({
                            renderDetails() {
                                if (output === 'node') return document.createElement('div');

                                if (output === 'promise') return Promise.resolve('<p>Async</p>');

                                return null;
                            },
                        });
                    }, output);

                    const error = page.waitForEvent('pageerror');

                    await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
                    expect((await error).message).toBe('Details renderer must return an HTML string.');
                    await expect(page.locator('.table-details')).toHaveCount(0);
                });
            }
        });
    });

    test.describe('lifecycle', () => {
        test('stops detail rendering when a display resolver disposes the table', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });

                let dispose = false;

                window.createResponsive({
                    columns: [
                        { class: 'test-cell', responsivePriority: null },
                        { class: 'test-cell' },
                        {
                            class: 'test-cell',
                            render(value, { purpose }) {
                                if (dispose && purpose === 'display') this.dispose();

                                return value;
                            },
                        },
                    ],
                });
                dispose = true;
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.locator('.table-responsive, .table-details')).toHaveCount(0);
            await expect(page.locator('#table th')).toHaveText(['Name', 'Team', 'Score']);
        });

        test('abandons obsolete details when a renderer replaces the dataset', async ({ page }) => {
            await page.evaluate(() => {
                $.setStyle('#host', { width: '240px' });

                let replace = false;

                window.table = window.createResponsive({
                    columns: [
                        { class: 'test-cell', responsivePriority: null },
                        { class: 'test-cell' },
                        {
                            class: 'test-cell',
                            render(value, { purpose }) {
                                if (replace && purpose === 'display') {
                                    replace = false;
                                    this.setData([['Newer', 'New team', 1]]);
                                }

                                return value;
                            },
                        },
                    ],
                });
                replace = true;
            });
            await page.getByRole('button', { name: 'Show details for row Alice', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Show details for row Newer', exact: true })).toBeVisible();
            await expect(page.locator('.table-details')).toHaveCount(0);
            expect(await page.evaluate(() => window.table.getData())).toEqual([['Newer', 'New team', 1]]);
        });

        test('keeps responsive layouts and expansion independent across instances', async ({ page }) => {
            await page.evaluate(() => {
                const clone = $.clone('#table')[0];

                $.setAttribute(clone, { id: 'second' });

                const host = $.create('div', { attributes: { id: 'second-host' }, style: { width: '240px' } });

                $.append(document.body, host);
                $.append(host, clone);
                $.append(document.head, $.create('style', {
                    text: '#second th[data-ui-index], #second td.test-cell { min-width: 160px; }',
                }));
                window.table = window.createResponsive();
                window.second = UI.Table.init(clone, {
                    data: [['Other', 'Different team', 10]],
                    rowId: 0,
                    responsive: true,
                    columns: [
                        { class: 'test-cell', responsivePriority: null },
                        { class: 'test-cell' },
                        { class: 'test-cell' },
                    ],
                });
            });
            await expect(page.locator('#table th[data-ui-index]:visible')).toHaveCount(3);
            await expect(page.locator('#second th[data-ui-index]:visible')).toHaveCount(1);
            await page.getByRole('button', { name: 'Show details for row Other', exact: true }).click();
            await page.evaluate(() => window.table.dispose());
            await expect(page.locator('#second .table-details dd')).toHaveText(['Different team', '10']);
            await page.evaluate(() => $.setStyle('#second-host', { width: '900px' }));
            await expect(page.locator('#second th[data-ui-index]:visible')).toHaveCount(3);
            await expect(page.locator('#second .table-details')).toHaveCount(0);
        });

        test('disconnects observation, cancels queued layout work, and restores source markup', async ({ page }) => {
            const original = await page.locator('#table').innerHTML();
            const disconnected = await page.evaluate(async () => {
                let disconnected = 0;
                const NativeObserver = window.ResizeObserver;

                window.ResizeObserver = class extends NativeObserver {
                    disconnect() {
                        disconnected++;
                        super.disconnect();
                    }
                };

                const table = window.createResponsive();

                $.setStyle('#host', { width: '240px' });
                table.dispose();
                await new Promise(requestAnimationFrame);
                await new Promise(requestAnimationFrame);

                return disconnected;
            });

            expect(disconnected).toBe(1);
            await expect(page.locator('#table')).toHaveJSProperty('innerHTML', original);
            await expect(page.locator('.table-details')).toHaveCount(0);
        });
    });
});
