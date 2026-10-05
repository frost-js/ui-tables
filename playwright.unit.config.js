import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './test/unit',
    testMatch: '**/*.test.js',
});
