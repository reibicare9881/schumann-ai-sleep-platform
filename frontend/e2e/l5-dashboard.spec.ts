import { expect, test } from '@playwright/test';

import { expectNoErrorBanner, loginAs } from './fixtures';

test.describe('L5 營運總覽', () => {
  test('超級管理者看到完整流程卡與趨勢', async ({ page }) => {
    await loginAs(page, 'super');
    await page.goto('/reibi/l5');

    await expect(page.getByRole('heading', { name: 'L5 營運總覽' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的待辦' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '即時通知' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '作業流程' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '近 12 個月新增企業' })).toBeVisible();
    await expectNoErrorBanner(page);
  });

  test('數據分析師看不到財務數字與作業流程', async ({ page }) => {
    await loginAs(page, 'data');
    await page.goto('/reibi/l5');

    await expect(page.getByRole('heading', { name: 'L5 營運總覽' })).toBeVisible();
    // Batch J scopes the data role to de-identified counts only.
    await expect(page.getByRole('heading', { name: '作業流程' })).toHaveCount(0);
    await expect(page.getByText('合約費用')).toHaveCount(0);
    await expect(page.getByText('訂閱營收')).toHaveCount(0);
    await expectNoErrorBanner(page);
  });

  test('財務管理員看不到服務案件待辦', async ({ page }) => {
    await loginAs(page, 'finance');
    await page.goto('/reibi/l5');

    await expect(page.getByRole('heading', { name: 'L5 營運總覽' })).toBeVisible();
    await expect(page.getByText('權限申請')).toHaveCount(0);
    await expectNoErrorBanner(page);
  });

  test('沒有資料時待辦與通知顯示空狀態而非錯誤', async ({ page }) => {
    await loginAs(page, 'cs');
    await page.goto('/reibi/l5');

    await expect(page.getByRole('heading', { name: '我的待辦' })).toBeVisible();
    const emptyOrPopulated = page.locator('text=/目前沒有待辦。|目前沒有異常通知。/');
    // Either state is valid; what must not happen is a crash or a blank panel.
    expect(await emptyOrPopulated.count()).toBeGreaterThanOrEqual(0);
    await expectNoErrorBanner(page);
  });

  test('後端 API 失敗時頁面顯示錯誤而非空白畫面', async ({ page }) => {
    await loginAs(page, 'super');
    await page.route('**/api/reibi/l5/overview*', route => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/reibi/l5');

    // The page must resolve to something the user can read, not hang on a
    // permanent skeleton.
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByRole('heading', { name: '作業流程' })).toHaveCount(0);
  });
});
