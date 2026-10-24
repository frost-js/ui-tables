import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table column picker', () => {
    test.beforeEach(setupTable);

    test.describe('configuration', () => {
        test('includes initially hidden data columns in the requested order', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                rowId: 1,
                selection: 'multiple',
                columns: [{}, { visible: false }],
                buttons: [{ type: 'columns', text: 'Choose fields', columns: [1, 0] }],
            }));
            const button = page.getByRole('button', { name: 'Choose fields' });
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await button.click();
            const picker = page.getByRole('group', { name: 'Choose fields' });

            await expect(picker.locator('label')).toHaveText(['Score', 'Name']);
            await expect(picker.getByRole('checkbox', { name: 'Score' })).not.toBeChecked();
            await expect(picker.getByRole('checkbox', { name: 'Name' })).toBeChecked();
            await expect(picker.getByRole('checkbox')).toHaveCount(2);
            expect(await button.getAttribute('aria-controls')).toBe(await picker.getAttribute('id'));
        });

        test('uses text labels and localized fallbacks without inserting heading markup', async ({ page }) => {
            await page.evaluate(() => {
                $.setHtml('thead tr', '<th><strong>Name &amp; team</strong></th><th> </th>');
                window.createTable({
                    lang: { column: 'Field {column}', buttons: { columns: 'Fields' } },
                    buttons: [{ type: 'columns' }],
                });
            });
            await page.getByRole('button', { name: 'Fields' }).click();
            const picker = page.getByRole('group', { name: 'Fields' });

            await expect(picker.locator('label')).toHaveText(['Name & team', 'Field 2']);
            await expect(picker.locator('strong')).toHaveCount(0);
        });

        for (const { columns, error } of [
            { columns: 'all', error: 'TypeError' },
            { columns: [2], error: 'RangeError' },
            { columns: [-1], error: 'RangeError' },
            { columns: [0, 0], error: 'RangeError' },
            { columns: ['1'], error: 'RangeError' },
        ]) {
            test(`rejects invalid column selection ${JSON.stringify(columns)} and cleans up`, async ({ page }) => {
                const result = await page.evaluate((columns) => {
                    const original = $.getHtml('#table');
                    let error;

                    try {
                        window.createTable({ buttons: [{ type: 'columns' }, { type: 'columns', columns }] });
                    } catch (caught) {
                        error = caught.name;
                    }

                    return { error, restored: $.getHtml('#table') === original };
                }, columns);

                expect(result).toEqual({ error, restored: true });
                await expect(page.locator('.dropdown-menu')).toHaveCount(0);
            });
        }

        test('supports an empty picker and preserves custom callback precedence', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                buttons: [
                    { type: 'columns', columns: [], text: 'Empty' },
                    {
                        type: 'columns', columns: 'ignored', text: 'Custom',
                        callback() {
                            this.hideColumn(0);
                        },
                    },
                ],
            }));
            await page.getByRole('button', { name: 'Empty' }).click();
            await expect(page.getByRole('group', { name: 'Empty' }).getByRole('checkbox')).toHaveCount(0);
            await page.getByRole('button', { name: 'Custom' }).click();
            await expect(page.locator('thead th')).toHaveText(['Score']);
            await expect(page.locator('.dropdown-menu')).toHaveCount(1);
        });
    });

    test.describe('visibility', () => {
        test('toggles once without resetting the view, closing the picker, or moving focus', async ({ page }) => {
            await page.evaluate(() => {
                window.table = window.createTable({ buttons: [{ type: 'columns' }] });
                window.table.order([[1, 'desc']]);
                window.table.page(2);
                window.before = window.table.getState();
                window.events = { draw: 0, state: 0, processing: 0 };
                $.addEvent('#table', 'draw.ui.table', () => window.events.draw++);
                $.addEvent('#table', 'statechange.ui.table', () => window.events.state++);
                $.addEvent('#table', 'processing.ui.table', () => window.events.processing++);
            });
            await page.getByRole('button', { name: 'Columns' }).click();
            expect(await page.evaluate(() => window.events)).toEqual({ draw: 0, state: 0, processing: 0 });
            const input = page.getByRole('group', { name: 'Columns' }).getByRole('checkbox', { name: 'Name' });
            await input.focus();
            await input.press('Space');
            await expect(input).toBeFocused();
            await expect(input).not.toBeChecked();
            await expect(page.getByRole('group', { name: 'Columns' })).toBeVisible();
            const result = await page.evaluate(() => {
                const expected = window.before;
                expected.columns[0].visible = false;

                return { events: window.events, state: window.table.getState(), expected, exported: window.table.getExportData() };
            });

            expect(result.events).toEqual({ draw: 1, state: 1, processing: 0 });
            expect(result.state).toEqual(result.expected);
            expect(result.exported).toEqual({ headings: ['Score'], rows: [[2], [1]] });
        });

        test('synchronizes multiple pickers through API changes and state restoration', async ({ page }) => {
            await page.evaluate(() => {
                window.table = window.createTable({ buttons: [
                    { type: 'columns', text: 'First picker', columns: [0] },
                    { type: 'columns', text: 'Second picker' },
                ] });
                window.saved = window.table.getState();
                window.table.hideColumn(0);
            });
            await page.getByRole('button', { name: 'First picker', exact: true }).click();
            await expect(page.getByRole('group', { name: 'First picker', exact: true }).getByRole('checkbox')).not.toBeChecked();
            await page.getByRole('button', { name: 'Second picker', exact: true }).click();
            const input = page.getByRole('group', { name: 'Second picker', exact: true }).getByRole('checkbox', { name: 'Name' });
            await input.focus();
            await page.evaluate(() => window.table.setState(window.saved));

            await expect(input).toBeFocused();
            await expect(input).toBeChecked();
            await expect(page.getByRole('group', { name: 'Second picker', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'First picker', exact: true }).click();
            await expect(page.getByRole('group', { name: 'First picker', exact: true }).getByRole('checkbox')).toBeChecked();
        });

        test('can hide every column and restore them, including footer and empty-result spans', async ({ page }) => {
            await page.evaluate(() => {
                $.append('#table', $.create('tfoot', { html: '<tr><td colspan="2">Total</td></tr>' }));
                window.table = window.createTable({ rowId: 1, selection: 'multiple', buttons: [{ type: 'columns' }] });
                window.table.search('missing');
            });
            await page.getByRole('button', { name: 'Columns' }).click();
            const picker = page.getByRole('group', { name: 'Columns' });
            await picker.getByRole('checkbox', { name: 'Name' }).uncheck();
            await expect(page.locator('tfoot td').last()).toHaveAttribute('colspan', '1');
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '2');
            await picker.getByRole('checkbox', { name: 'Score' }).uncheck();
            await expect(page.locator('tfoot td').last()).toBeHidden();
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '1');
            await picker.getByRole('checkbox', { name: 'Name' }).check();
            await picker.getByRole('checkbox', { name: 'Score' }).check();
            await expect(page.locator('tfoot td').last()).toHaveAttribute('colspan', '2');
            await expect(page.locator('tfoot td').last()).toBeVisible();
            await expect(page.locator('tbody td')).toHaveAttribute('colspan', '3');
            await expect(page.locator('thead th')).toHaveCount(3);
        });

        test('maps footer row spans to original columns and restores original markup on disposal', async ({ page }) => {
            const result = await page.evaluate(() => {
                $.append('#table', $.create('tfoot', {
                    html: '<tr><td rowspan="2">Name</td><td>First score</td></tr><tr><td>Second score</td></tr>',
                }));
                const original = $.getHtml('#table');
                const table = window.createTable({ buttons: [{ type: 'columns' }] });
                table.hideColumn(1);
                const hidden = $.find('tfoot td').map((cell) => cell.hidden);
                table.showColumn(1);
                const restored = $.find('tfoot td').every((cell) => !cell.hidden);
                table.dispose();

                return { hidden, restored, original: $.getHtml('#table') === original };
            });

            expect(result).toEqual({ hidden: [false, true, true], restored: true, original: true });
        });
    });

    test.describe('keyboard and lifecycle', () => {
        test('opens with an arrow key, toggles with Space, and restores focus with Escape', async ({ page }) => {
            await page.evaluate(() => window.createTable({ buttons: [{ type: 'columns' }] }));
            const button = page.getByRole('button', { name: 'Columns' });
            await button.focus();
            await button.press('ArrowDown');
            const input = page.getByRole('group', { name: 'Columns' }).getByRole('checkbox', { name: 'Name' });
            await expect(input).toBeFocused();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await input.press('Space');
            await expect(input).not.toBeChecked();
            await input.press('Escape');
            await expect(button).toBeFocused();
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await expect(page.getByRole('group', { name: 'Columns' })).toBeHidden();
        });

        test('dismisses on outside interaction and tabbing out', async ({ page }) => {
            await page.evaluate(() => window.createTable({ buttons: [{ type: 'columns' }] }));
            const button = page.getByRole('button', { name: 'Columns' });
            await button.click();
            await page.getByRole('searchbox').click();
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await button.click();
            const picker = page.getByRole('group', { name: 'Columns' });
            await picker.getByRole('checkbox', { name: 'Score' }).focus();
            await picker.getByRole('checkbox', { name: 'Score' }).press('Tab');
            await expect(button).toHaveAttribute('aria-expanded', 'false');
        });

        test('isolates instances and releases an open dropdown during disposal', async ({ page }) => {
            await page.evaluate(() => {
                const clone = $.clone('#table')[0];
                $.setAttribute(clone, { id: 'second' });
                $.append(document.body, clone);
                window.table = window.createTable({ buttons: [{ type: 'columns', text: 'First fields' }] });
                window.second = UI.Table.init(clone, { data: [['Other', 9]], buttons: [{ type: 'columns', text: 'Second fields' }] });
            });
            await page.getByRole('button', { name: 'First fields' }).click();
            await page.getByRole('group', { name: 'First fields' }).getByRole('checkbox', { name: 'Name' }).uncheck();
            await page.getByRole('button', { name: 'Second fields' }).click();
            await expect(page.getByRole('group', { name: 'Second fields' }).getByRole('checkbox', { name: 'Name' })).toBeChecked();
            await page.evaluate(() => window.second.dispose());
            await expect(page.locator('.dropdown-menu')).toHaveCount(1);
            await page.getByRole('button', { name: 'First fields' }).click();
            await page.getByRole('group', { name: 'First fields' }).getByRole('checkbox', { name: 'Name' }).check();
            await page.evaluate(() => window.table.dispose());
            await expect(page.locator('.dropdown-menu, [data-ui-toggle="dropdown"]')).toHaveCount(0);
            await expect(page.locator('#table th')).toHaveText(['Name', 'Score']);
            await page.keyboard.press('Escape');
        });

        test('stops safely when a visibility notification disposes the table', async ({ page }) => {
            await page.evaluate(() => {
                const table = window.createTable({ buttons: [{ type: 'columns' }] });
                $.addEvent('#table', 'statechange.ui.table', () => table.dispose());
            });
            await page.getByRole('button', { name: 'Columns' }).click();
            await page.getByRole('group', { name: 'Columns' }).getByRole('checkbox', { name: 'Name' }).click();
            await expect(page.locator('.dropdown-menu')).toHaveCount(0);
            await expect(page.locator('#table th')).toHaveText(['Name', 'Score']);
        });
    });
});
