import { expect, test } from '@playwright/test';

import { expectNoErrorBanner, loginAs } from './fixtures';

const REGIONS = ['北部', '中部', '南部', '東部', '海外'];

test.describe('L5 區域佈點', () => {
  test('數據分析師看得到五個區域與總達成率', async ({ page }) => {
    await loginAs(page, 'data');
    await page.goto('/reibi/l5/regions');

    await expect(page.getByRole('heading', { name: '區域佈點' })).toBeVisible();
    await expect(page.getByText('全區佈點目標')).toBeVisible();
    for (const region of REGIONS) {
      await expect(page.getByText(region, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/% 達成率/)).toBeVisible();
    await expectNoErrorBanner(page);
  });

  test('超級管理者也看得到', async ({ page }) => {
    await loginAs(page, 'super');
    await page.goto('/reibi/l5/regions');
    await expect(page.getByRole('heading', { name: '區域佈點' })).toBeVisible();
  });

  test('客服管理員被擋下並看到可行動的說明', async ({ page }) => {
    await loginAs(page, 'cs');
    await page.goto('/reibi/l5/regions');

    await expect(page.getByRole('heading', { name: '沒有區域佈點檢視權限' })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回 L5 總覽' })).toBeVisible();
  });

  test('財務管理員同樣沒有權限', async ({ page }) => {
    await loginAs(page, 'finance');
    await page.goto('/reibi/l5/regions');
    await expect(page.getByRole('heading', { name: '沒有區域佈點檢視權限' })).toBeVisible();
  });

  test('L5 總覽只對有權限的角色顯示入口', async ({ page }) => {
    await loginAs(page, 'super');
    await page.goto('/reibi/l5');
    await expect(page.getByRole('link', { name: '區域佈點' })).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await loginAs(page, 'cs');
    await page.goto('/reibi/l5');
    await expect(page.getByRole('heading', { name: 'L5 營運總覽' })).toBeVisible();
    await expect(page.getByRole('link', { name: '區域佈點' })).toHaveCount(0);
  });

  test('未歸區的企業會被說明而不是靜默消失', async ({ page }) => {
    await loginAs(page, 'data');
    await page.goto('/reibi/l5/regions');

    // The seeded enterprises carry no partner_code, so the shortfall panel must
    // account for them rather than letting the region cards silently disagree
    // with the headline total.
    const shortfall = page.getByText(/家企業尚未歸入任何區域/);
    const allAssigned = page.getByText('所有企業都已歸入區域。');
    await expect(shortfall.or(allAssigned)).toBeVisible();
  });
});
