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
    await expect(nextChips(page)).toHaveCount(3);
});

test('passing drops the wave; undo takes it back for a charge', async ({ page }) => {
    await dismissRules(page);
    const before = await letters(page);
    await page.getByRole('button', { name: /Pass/ }).click();
    await expect(tiles(page)).toHaveCount(11);
    await page.getByRole('button', { name: /Undo \(3 left\)/ }).click();
    await expect(page.getByRole('button', { name: /Undo \(2 left\)/ })).toBeVisible();
    await expect(tiles(page)).toHaveCount(8);
    expect(await letters(page)).toBe(before);
});

// Find a pivot whose ring actually spins, then spin it with the keyboard
const spinOnce = async (page: Page) => {
    const ids = await page.$$eval('[data-ocell]', els => els.map(e => (e as HTMLElement).dataset.ocell!));
    for (const id of ids) {
        const cell = page.locator(`[data-ocell="${id}"]`);
        if (!(await cell.getAttribute('data-letter'))) continue;
        await cell.click();
        await page.waitForTimeout(350);
        if (await page.locator('.orbit-cell--ring').count()) break;
        await page.keyboard.press('Escape');
    }
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
};

test('the first spin each turn is free, the second grows the wave', async ({ page }) => {
    await dismissRules(page);
    await spinOnce(page);
    await expect(nextChips(page)).toHaveCount(3);
    await spinOnce(page);
    await expect(nextChips(page)).toHaveCount(4);
});

test('an unused free spin carries over to the next turn', async ({ page }) => {
    await dismissRules(page);
    await page.getByRole('button', { name: /Pass/ }).click();
    await expect(page.getByText('2 free spins')).toBeVisible();
    await spinOnce(page);
    await spinOnce(page);
    await expect(nextChips(page)).toHaveCount(3);
    await spinOnce(page);
    await expect(nextChips(page)).toHaveCount(4);
});

test('the daily is deterministic and survives a reload', async ({ page }) => {
    await dismissRules(page);
    await page.getByRole('button', { name: /Pass/ }).click();
    await expect(tiles(page)).toHaveCount(11);
    const board = await letters(page);
    await page.reload();
    await expect(tiles(page)).toHaveCount(11);
    expect(await letters(page)).toBe(board);
});
