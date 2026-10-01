import process from 'node:process';
import { test as base, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';
import { setupClock } from '../setup/browser.js';

const collectCoverage = process.env.FROST_UI_TABLES_COVERAGE === 'true';

const test = base.extend({
    mockClock: [false, { option: true }],
    uiPage: [
        async ({ page, mockClock }, use, testInfo) => {
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));

            if (collectCoverage) {
                await page.coverage.startJSCoverage({ resetOnNavigation: false });
            }

            if (mockClock) {
                await setupClock(page);
            }

            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await page.evaluate((_) => {
                if (!window.fQuery || !window.UI?.Table ||
                    typeof window.fQuery.QuerySet.prototype.table !== 'function') {
                    throw new Error('Failed to initialize Tables on the test page.');
                }

                document.body.replaceChildren();
            });

            await page.waitForFunction((_) => {
                const node = document.createElement('div');
                node.className = 'table-sort text-center';
                document.body.append(node);

                const style = getComputedStyle(node);
                const ready = style.position === 'relative' &&
                    style.textAlign === 'center';

                node.remove();
                return ready;
            });

            await use();

            expect(errors, 'uncaught browser errors').toHaveLength(0);

            if (collectCoverage) {
                const coverage = await page.coverage.stopJSCoverage();
                await addCoverageReport(coverage, testInfo);
            }
        },
        { auto: true },
    ],
});

export { expect, test };
