import { expect, test } from '#test';

test.describe('Table bundles', () => {
    for (const { name, path, text } of [
        { name: 'ESM', path: '/esm.html', text: 'ESM row' },
        { name: 'minified ESM', path: '/esm.html?minified', text: 'ESM row' },
        { name: 'minified UMD', path: '/umd-min.html', text: 'UMD row' },
    ]) {
        test(`initializes with shared dependencies (${name})`, async ({ page }) => {
            await page.goto(path);

            await expect(page.locator('tbody td')).toHaveText(text);
            await expect(page.locator('body')).toHaveAttribute('data-shared', 'true');
            await expect(page.getByRole('searchbox')).toBeVisible();
        });
    }
});
