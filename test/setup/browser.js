/** @import { Page } from '@playwright/test'; */
/**
 * Installs and pauses the test clock at a fixed time.
 * @param {Page} page The test page.
 */
export async function setupClock(page) {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(60000);
}
