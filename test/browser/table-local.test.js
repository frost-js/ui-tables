import { expect, test } from '#test';
import { setupTable } from '../setup/table.js';

test.describe('Table local data', () => {
    test.beforeEach(setupTable);

    test.describe('user events', () => {
        test('pages through a long result set using first, previous, numbered and last controls', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: Array.from({ length: 40 }, (_, index) => [`Row ${index + 1}`, index + 1]),
                order: [[1, 'asc']],
            }));

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


        test('appends a shift-sort key to filtered results', async ({ page }) => {
            await page.evaluate(() => window.createTable().search('A'));

            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });
            await page.getByRole('columnheader', { name: /Score/ }).click({ modifiers: ['Shift'] });

            await expect(page.locator('tbody td')).toHaveText(['A', '3', 'A', '1']);
        });

        test('leaves nonorderable headings and disabled features unchanged', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                columns: [{ orderable: false }, {}],
                paging: false,
                searching: false,
            }));

            await page.getByRole('columnheader', { name: 'Name', exact: true }).click();

            await page.evaluate(() => {
                const table = $('#table').table();

                table.search('missing');
                table.page(5);
                table.length(1);
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

    test.describe('data option', () => {
        test('renders supplied object rows with nested column paths', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                data: [{ name: 'Zoe', result: { score: 8 } }, { name: 'Ada', result: { score: 9 } }],
                columns: [{ data: 'name' }, { data: 'result.score' }],
            }));

            await expect(page.locator('#table tbody td')).toHaveText(['Ada', '9', 'Zoe', '8']);
        });
    });

    test.describe('debounce option', () => {
        test.use({ mockClock: true });

        test('debounces typed local search', async ({ page }) => {
            await page.evaluate(() => window.createTable({ debounce: 20 }));

            await page.getByRole('searchbox').fill('A');

            await page.clock.runFor(19);

            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 2 of 4');

            await page.clock.runFor(1);

            await expect(page.locator('tbody td')).toHaveText(['A', '1', 'A', '3']);
            await expect(page.getByRole('status')).toContainText('of 2 (filtered from 4 total)');
        });
    });

    test.describe('paging option', () => {
        test('renders all rows when paging is disabled', async ({ page }) => {
            await page.evaluate(() => window.createTable({
                paging: false,
                length: 1,
            }));

            await expect(page.locator('#table tbody tr')).toHaveCount(4);
            await expect(page.locator('[data-ui-page]')).toHaveCount(0);
            await expect(page.getByRole('status')).toHaveText('Showing results 1 to 4 of 4');
        });
    });
});
