import { expect, test } from '@playwright/test';

import { expectNoErrorBanner, loginAs } from './fixtures';

/**
 * Appointment site pre-selection (MP-06D). The column and its foreign key
 * already existed; what was missing was a site list a booker could actually
 * reach and a selector to use it.
 */

test.describe('預約服務場域', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/appointment');
  });

  test('單位成員看得到自己單位的場域選單', async ({ page }) => {
    const selector = page.getByLabel('服務場域');
    await expect(selector).toBeVisible({ timeout: 20_000 });

    await expect(selector.locator('option')).toContainText([
      '未指定場域',
      'E2E 台北場域',
      'E2E 新竹場域',
    ]);
    await expectNoErrorBanner(page);
  });

  test('選定場域後可以完成預約，並在清單顯示場域', async ({ page }) => {
    await page.getByLabel('預約日期').fill('2026-12-01');
    await page.getByRole('button', { name: '09:00' }).first().click();
    await page.getByLabel('服務場域').selectOption({ label: 'E2E 台北場域（台北市測試路 1 號）' });

    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: /送出預約申請/ }).click();

    await expect(page.getByText('E2E 台北場域').last()).toBeVisible({ timeout: 20_000 });
    await expectNoErrorBanner(page);
  });

  test('未選場域仍可預約', async ({ page }) => {
    // 以筆數增減判定成功。清單的日期是拆成月份縮寫與日兩格顯示，用日期字串比對
    // 會匹配到多個元素，也無法證明真的多了一筆。
    const counter = page.getByText(/^共 \d+ 筆$/);
    const before = Number((await counter.textContent())!.replace(/\D/g, ''));

    await page.getByLabel('預約日期').fill('2026-12-02');
    await page.getByRole('button', { name: '10:00' }).first().click();

    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: /送出預約申請/ }).click();

    await expect(counter).toHaveText(`共 ${before + 1} 筆`, { timeout: 20_000 });
    await expectNoErrorBanner(page);
  });

  test('送出前必須先選日期與時段', async ({ page }) => {
    await expect(page.getByRole('button', { name: /送出預約申請/ })).toBeDisabled();
  });

  test('場域選單不會出現其他單位的場域', async ({ page }) => {
    const options = await page.getByLabel('服務場域').locator('option').allTextContents();
    for (const label of options) {
      expect(label === '未指定場域' || label.startsWith('E2E ')).toBeTruthy();
    }
  });
});
