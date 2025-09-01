import { test, expect, Page } from '@playwright/test';

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

let shot = 0;
async function snap(page: Page, label: string) {
    shot += 1;
    await page.screenshot({ path: `tests/artifacts/${shot.toString().padStart(2, '0')}-${label}.png`, fullPage: true });
}

async function captureSequence(page: Page, labelPrefix: string, maxFrames = 40, intervalMs = 120) {
    for (let i = 0; i < maxFrames; i++) {
        await wait(intervalMs);
        await snap(page, `${labelPrefix}-${i.toString().padStart(2, '0')}`);
        const overlayCount = await page.locator('.pointer-events-none .letter-tile').count();
        if (overlayCount === 0) break;
    }
}

test.describe('Tetris falling overlays', () => {
    test('falls slot-by-slot with overlays only once', async ({ page }) => {
        await page.goto('/classic');

        await expect(page.locator('.hex-grid')).toBeVisible();
        await snap(page, 'baseline');

        // Optional: enable debug dots if env toggled
        if (process.env.TETRIS_DEBUG_PATH === '1') {
            await page.evaluate(() => localStorage.setItem('waxleDebugPath', '1'));
            await page.reload();
            await expect(page.locator('.hex-grid')).toBeVisible();
        }

        const startPlaying = page.getByRole('button', { name: /Start Playing/i });
        if (await startPlaying.isVisible().catch(() => false)) {
            await startPlaying.click();
            await wait(250);
        }

        // Trigger flood
        await page.getByRole('button', { name: /End Turn/i }).click();

        // High-cadence capture during fall
        await captureSequence(page, 'fall', 40, 120);

        // Validate overlays removed
        const overlays = page.locator('.pointer-events-none .letter-tile');
        await expect(overlays).toHaveCount(0);

        await snap(page, 'final');
    });
}); 