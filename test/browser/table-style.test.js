import { expect, test } from '#test';

test.describe('Table styles', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            $.setHtml(document.body, '<table id="table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody></tbody></table>');

            window.startTable = (options = {}) => UI.Table.init($.findOne('#table'), {
                data: [['Alice', 1], ['Bob', 2]],
                buttons: [{ type: 'csv' }],
                ...options,
            });
        });
    });

    test.describe('controls and layout', () => {
        for (const { inputStyle, focusProperty } of [
            { inputStyle: 'filled', focusProperty: 'background-image' },
            { inputStyle: 'outline', focusProperty: 'box-shadow' },
        ]) {
            test(`uses UI ${inputStyle} controls with accessible labels`, async ({ page }) => {
                await page.evaluate((inputStyle) => window.startTable({ inputStyle }), inputStyle);

                await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveClass(new RegExp(`input-${inputStyle}`));
                await expect(page.getByRole('combobox', { name: /Per Page/ })).toHaveValue('10');
                await expect(page.locator('.ripple-line')).toHaveCount(0);

                await page.getByRole('searchbox').focus();

                await expect(page.getByRole('searchbox')).toBeFocused();

                await expect(page.getByRole('searchbox')).not.toHaveCSS(focusProperty, 'none');
            });
        }

        test('contains a wide table within the narrow viewport', async ({ page }) => {
            await page.setViewportSize({ width: 360, height: 640 });

            await page.evaluate(() => {
                $.setStyle($.findOne('#table'), 'minWidth', '1000px');
                window.startTable();
            });

            await expect(page.locator('.table-responsive')).toHaveCSS('overflow-x', 'auto');
            expect(await page.locator('.table-responsive').evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
            await expect(page.getByRole('searchbox')).toBeInViewport();
        });
    });

    test.describe('sort indicators and focus', () => {
        for (const theme of ['light', 'dark']) {
            test(`uses the primary token for the active arrow and a visible focus treatment (${theme})`, async ({ page }) => {
                await page.evaluate((theme) => {
                    $.setDataset(document.documentElement, 'uiTheme', theme);
                    $.setStyle(document.body, '--ui-primary', 'rgb(120, 30, 90)');
                    window.startTable();
                }, theme);

                const heading = page.locator('th').first();

                expect(await heading.evaluate((node) => getComputedStyle(node, '::before').borderBottomColor)).toBe('rgb(120, 30, 90)');

                await heading.focus();

                await expect(heading).not.toHaveCSS('box-shadow', 'none');

                await heading.press('Enter');

                await expect(heading).toHaveAttribute('aria-sort', 'descending');
                expect(await heading.evaluate((node) => getComputedStyle(node, '::after').borderTopColor)).toBe('rgb(120, 30, 90)');
            });
        }
    });

    test.describe('button styling', () => {
        for (const theme of ['light', 'dark']) {
            test(`uses UI 4 button color and focus tokens (${theme})`, async ({ page }) => {
                await page.evaluate((theme) => {
                    $.setDataset(document.documentElement, 'uiTheme', theme);
                    $.setStyle(document.body, '--ui-secondary-color', 'rgb(120, 30, 90)');
                    window.startTable();
                }, theme);

                const button = page.getByRole('button', { name: 'CSV' });

                await expect(button).toHaveCSS('color', 'rgb(120, 30, 90)');
                await expect(button).toHaveCSS('border-top-color', 'rgb(120, 30, 90)');

                await button.focus();

                await expect(button).not.toHaveCSS('box-shadow', 'none');

                await button.hover();

                await expect(button).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

                await button.evaluate((node) => $.addClass(node, 'active'));

                await expect(button).toHaveCSS('color', 'rgb(120, 30, 90)');
                await expect(button).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
            });
        }
    });

    test.describe('RTL', () => {
        for (const direction of ['ltr', 'rtl']) {
            test(`places sort arrows at the logical end (${direction})`, async ({ page }) => {
                await page.evaluate((direction) => {
                    $.setProperty(document.documentElement, 'dir', direction);
                    window.startTable();
                }, direction);

                const heading = page.locator('th').first();
                const side = direction === 'ltr' ? 'right' : 'left';

                expect(await heading.evaluate((node, side) => getComputedStyle(node, '::before')[side], side)).toBe('8px');

                const padding = await heading.evaluate((node, side) => {
                    return Number.parseFloat(getComputedStyle(node).getPropertyValue(`padding-${side}`));
                }, side);

                expect(padding).toBeCloseTo(27.2, 2);
            });
        }
    });
});
