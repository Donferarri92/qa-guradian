import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'https://casacarigar.com';

export default defineConfig({
    testDir: './',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }],
    ],

    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        // Default viewport
        viewport: { width: 1280, height: 720 },

        // Reasonable timeouts
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },

    timeout: 60000,

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'mobile-safari',
            use: { ...devices['iPhone 12'] },
        },
    ],

    // Output directory for screenshots and traces
    outputDir: 'test-results/',
});
