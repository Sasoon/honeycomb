import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'on'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
}); 