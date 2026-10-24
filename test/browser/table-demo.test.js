import { expect, test } from '#test';

test.describe('Table demo', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/*', async (route) => {
            const css = route.request().url().endsWith('.css');
            const asset = css ? 'frost-ui.css' : 'frost-ui-bundle.js';

            await route.fulfill({
                path: new URL(`../../node_modules/@fr0st/ui/dist/${asset}`, import.meta.url).pathname,
                contentType: css ? 'text/css' : 'text/javascript',
            });
        });
        await page.goto('/demo/');
        await expect(page.locator('#basic-table tbody tr')).toHaveCount(5);
    });

    test('initializes each showcase, formats the footer, and exports visible rows', async ({ page }) => {
        await expect(page.locator('.table-responsive')).toHaveCount(6);
        await expect(page.locator('#data-table tbody td:first-child').first()).toHaveText('Jules');

        await page.getByLabel('Data source', { exact: true }).selectOption('objects');

        await expect(page.locator('#data-table tbody td:first-child').first()).toHaveText('Jules');
        await expect(page.locator('#data-config')).toContainText('data: \'person.name\'');

        await page.getByLabel('Data source', { exact: true }).selectOption('arrays');

        await expect(page.locator('#data-table tbody td:first-child').first()).toHaveText('Jules');
        await expect(page.locator('#data-config')).toContainText('data: [[\'Alice\', \'Design\', 80]]');
        await expect(page.locator('#callback-table tfoot td:last-child')).toHaveText('410');

        await page.getByRole('button', { name: 'Hide Team column' }).click();

        await expect(page.locator('#export-table th')).toHaveText(['Name', 'Score']);

        const download = page.waitForEvent('download');
        await page.locator('#exports').getByRole('button', { name: 'CSV', exact: true }).click();

        expect((await download).suggestedFilename()).toBe('Team scores.csv');
    });

    test('applies controls and direction, then disposes and initializes through the API playground', async ({ page }) => {
        await page.getByLabel('Pagination', { exact: true }).uncheck();

        await expect(page.locator('#basic-table tbody tr')).toHaveCount(6);

        await page.getByLabel('Searching', { exact: true }).uncheck();

        await expect(page.locator('#basic').getByRole('searchbox')).toHaveCount(0);

        await page.getByLabel('Custom layout', { exact: true }).check();

        await expect(page.locator('#basic')).toContainText('Team leaderboard');

        await page.getByRole('button', { name: 'Right-to-left layout' }).click();

        await expect(page.locator('#basic-table')).toHaveCSS('direction', 'rtl');

        await page.getByRole('button', { name: 'Get first score', exact: true }).click();

        await expect(page.locator('#method-output')).toHaveText('"93"');

        await page.getByRole('button', { name: 'Clear rows', exact: true }).click();

        await expect(page.locator('#method-table tbody td')).toHaveText('No data available');

        await page.getByRole('button', { name: 'Add row', exact: true }).click();

        await expect(page.locator('#method-table tbody td')).toHaveText(['Morgan', 'Support', '97']);

        await page.getByRole('button', { name: 'Dispose', exact: true }).click();

        await expect(page.locator('#methods-events .table-responsive')).toHaveCount(0);

        await page.getByRole('button', { name: 'Init', exact: true }).click();

        await expect(page.locator('#methods-events .table-responsive')).toHaveCount(1);
        await expect(page.getByRole('log')).toContainText('init.ui.table');
    });

    test('recovers from a failed remote request and cancels a superseded search', async ({ page }) => {
        await expect(page.locator('#remote-message')).toHaveText('Results ready.');

        await page.getByRole('button', { name: 'Fail next request' }).click();

        await expect(page.locator('#remote-message')).toContainText('Simulated request failure');

        await page.getByRole('button', { name: 'Retry', exact: true }).click();

        await expect(page.locator('#remote-message')).toHaveText('Results ready.');

        await page.getByRole('button', { name: 'Replace pending search' }).click();

        await expect(page.locator('#request-log')).toContainText('cancelled');
        await expect(page.locator('#remote-table tbody td:first-child')).toHaveText(['Bob 14', 'Bob 2', 'Bob 26']);
    });

    test('keeps the showcase within a narrow viewport and saves its theme selection', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

        await page.getByLabel('Theme', { exact: true }).selectOption('dark');

        await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'dark');

        await page.reload();

        await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');

        await page.getByLabel('Theme', { exact: true }).selectOption('system');

        await expect(page.locator('html')).not.toHaveAttribute('data-ui-theme');
    });
});
