import { expect, test } from '#test';

test.describe('Table demo', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/*', async (route) => {
            const css = route.request().url().endsWith('.css');
            await route.fulfill({
                path: new URL(css ? '../../node_modules/@fr0st/ui/dist/frost-ui.css' : '../../node_modules/@fr0st/ui/dist/frost-ui-bundle.js', import.meta.url).pathname,
                contentType: css ? 'text/css' : 'text/javascript',
            });
        });
        await page.goto('/demo/');
        await expect(page.locator('#basic-table tbody tr')).toHaveCount(5);
    });

    test('initializes each showcase, formats the footer, and exports visible rows', async ({ page }) => {
        await expect(page.locator('.table-responsive')).toHaveCount(10);
        await expect(page.locator('#object-table tbody td:first-child').first()).toHaveText('Alice');
        await expect(page.locator('#callback-table tfoot td:last-child')).toHaveText('410');
        await page.getByRole('button', { name: 'Add the first row' }).click();
        await expect(page.locator('#empty-table tbody td')).toHaveText(['New teammate', 'Design', '0']);
        await page.getByRole('button', { name: 'Hide Team column' }).click();
        await expect(page.locator('#export-table th')).toHaveText(['Name', 'Score']);
        const download = page.waitForEvent('download');
        await page.locator('#exports').getByRole('button', { name: 'CSV', exact: true }).click();
        expect((await download).suggestedFilename()).toBe('Team scores.csv');
    });

    test('applies controls and direction, then disposes and initializes through the API playground', async ({ page }) => {
        await page.getByLabel('Pagination', { exact: true }).uncheck();
        await expect(page.locator('#control-table tbody tr')).toHaveCount(12);
        await page.getByLabel('Searching', { exact: true }).uncheck();
        await expect(page.locator('#controls').getByRole('searchbox')).toHaveCount(0);
        await page.getByRole('button', { name: 'Right-to-left layout' }).click();
        await expect(page.locator('#layout-table')).toHaveCSS('direction', 'rtl');
        await page.getByLabel('Method', { exact: true }).selectOption('getValue');
        await page.getByRole('button', { name: 'Run method' }).click();
        await expect(page.locator('#method-output')).toHaveText('"93"');
        await page.getByLabel('Method', { exact: true }).selectOption('dispose');
        await page.getByRole('button', { name: 'Run method' }).click();
        await expect(page.locator('#methods-events .table-responsive')).toHaveCount(0);
        await page.getByLabel('Method', { exact: true }).selectOption('init');
        await page.getByRole('button', { name: 'Run method' }).click();
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
