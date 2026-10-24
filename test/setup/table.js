/** @import { Page } from '@playwright/test'; */

/**
 * Creates a captioned table and a factory for local-data scenarios.
 * @param {{page: Page}} fixtures The Playwright fixtures.
 */
export async function setupTable({ page }) {
    await page.evaluate(() => {
        $.setHtml(document.body,
            '<table id="table">' +
            '<caption>Scores</caption>' +
            '<thead><tr><th>Name</th><th>Score</th></tr></thead>' +
            '<tbody></tbody></table>',
        );

        window.createTable = (options = {}) => UI.Table.init($.findOne('#table'), {
            data: [['B', 2], ['A', 1], ['A', 3], ['C', 4]],
            length: 2,
            lengths: [2, 4],
            debounce: 0,
            ...options,
        });
    });
}

/**
 * Creates two native tables for markup, registration, and disposal cases.
 * @param {{page: Page}} fixtures The Playwright fixtures.
 */
export async function setupDomTable({ page }) {
    await page.evaluate(() => {
        $.setHtml(document.body,
            '<table id="table1" class="original" aria-describedby="description">' +
                '<thead><tr><th>Name</th><th>Score</th></tr></thead>' +
                '<tbody><tr><td>Charlie</td><td>30</td></tr>' +
                '<tr><td>Alice</td><td>10</td></tr><tr><td>Bob</td><td>20</td></tr></tbody>' +
                '</table><p id="description">Original description</p>' +
                '<table id="table2"><thead><tr><th>Name</th></tr></thead>' +
                '<tbody><tr><td>Dana</td></tr></tbody></table>',
        );
    });
}
