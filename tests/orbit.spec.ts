import { test, expect, Page } from '@playwright/test';

const tiles = (page: Page) => page.locator('[data-ocell][data-letter]:not([data-letter=""])');
const nextChips = (page: Page) => page.locator('aside .anim-chip-in');
const letters = (page: Page) =>
    page.$$eval('[data-ocell]', els => els.map(e => `${(e as HTMLElement).dataset.ocell}:${(e as HTMLElement).dataset.letter}`).join(','));

const dismissRules = async (page: Page) => {
    await page.getByRole('button', { name: "Let's go" }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
};

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
});

test('first visit shows the rules, then a seeded board', async ({ page }) => {
    await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    await page.getByRole('button', { name: "Let's go" }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(8);
    await expect(nextChips(page)).toHaveCount(4);
});

test('passing drops the wave and grows it; undo takes it back', async ({ page }) => {
    await dismissRules(page);
    const before = await letters(page);
    await page.getByRole('button', { name: /Pass/ }).click();
    await expect(tiles(page)).toHaveCount(12);
    await expect(nextChips(page)).toHaveCount(5);
    await page.getByRole('button', { name: /Undo \(3 left\)/ }).click();
    await expect(page.getByRole('button', { name: /Undo \(2 left\)/ })).toBeVisible();
    await expect(nextChips(page)).toHaveCount(4);
    expect(await letters(page)).toBe(before);
});

test('the daily is deterministic and survives a reload', async ({ page }) => {
    await dismissRules(page);
    await page.getByRole('button', { name: /Pass/ }).click();
    await expect(tiles(page)).toHaveCount(12);
    const board = await letters(page);
    await page.reload();
    await expect(tiles(page)).toHaveCount(12);
    expect(await letters(page)).toBe(board);
});
