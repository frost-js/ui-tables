/** @import { Page } from '@playwright/test'; */

/**
 * Installs and pauses the browser clock at a stable time.
 * @param {Page} page The Playwright page.
 * @returns {Promise<void>} The promise.
 */
export async function setupClock(page) {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(60000);
}
