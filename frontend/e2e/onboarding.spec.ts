import { expect, test } from '@playwright/test';

import { expectNoErrorBanner, loginAs } from './fixtures';

/** Aliases must be 2–4 characters of A–Z0–9 and unique per enterprise. */
function uniqueAlias(): string {
  return `E${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

test.describe('新案開通', () => {
  test('三步驟建立企業並產生案件與憑證函編號', async ({ page }) => {
    const alias = uniqueAlias();
    const orgName = `E2E測試企業-${alias}`;

    await loginAs(page, 'super');
    await page.goto('/reibi/onboarding');

    await page.getByLabel('企業名稱 *').fill(orgName);
    await page.getByLabel('代碼別名（2–4 碼）*').fill(alias);
    await page.getByLabel('管理員 Email *').fill(`e2e-${alias.toLowerCase()}@example.test`);
    await page.getByLabel('聯絡人 *').fill('E2E 測試聯絡人');
    await page.getByLabel('授權人數 *').fill('10');
    await page.getByLabel('合約開始 *').fill('2026-09-01');
    await page.getByLabel('合約結束 *').fill('2027-08-31');

    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByRole('heading', { name: 'B 層設備' })).toBeVisible();

    await page.getByRole('button', { name: '新增場域' }).click();
    await page.getByPlaceholder('場域名稱').fill('E2E 測試場域');
    await page.getByPlaceholder('地址').fill('台北市測試路 1 號');

    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('A 層授權').fill('12000');

    await page.getByRole('button', { name: '確認開通' }).click();

    await expect(page.getByRole('heading', { name: '開通完成' })).toBeVisible({ timeout: 30_000 });
    // .first(): the recent-cases list below repeats the same identifiers, so an
    // exact-text locator legitimately resolves to more than one element.
    await expect(page.getByText(/^CASE-\d{4}-\d{6}$/).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`^ORG-${alias}-\\d{2}-\\d{6}$`)).first()).toBeVisible();
    await expect(page.getByText(/^CRED-\d{4}-\d{6}$/).first()).toBeVisible();
    await expectNoErrorBanner(page);
  });

  test('必填欄位未填時不會前進到下一步', async ({ page }) => {
    await loginAs(page, 'super');
    await page.goto('/reibi/onboarding');

    await page.getByLabel('企業名稱 *').fill('只填了名稱');
    await page.getByRole('button', { name: '下一步' }).click();

    // Still on step 1: the B-layer heading belongs to step 2.
    await expect(page.getByRole('heading', { name: 'B 層設備' })).toHaveCount(0);
  });

  test('憑證函可下載且為 PDF', async ({ page }) => {
    const alias = uniqueAlias();

    await loginAs(page, 'super');
    await page.goto('/reibi/onboarding');
    await page.getByLabel('企業名稱 *').fill(`E2E憑證測試-${alias}`);
    await page.getByLabel('代碼別名（2–4 碼）*').fill(alias);
    await page.getByLabel('管理員 Email *').fill(`cred-${alias.toLowerCase()}@example.test`);
    await page.getByLabel('聯絡人 *').fill('E2E 測試聯絡人');
    await page.getByLabel('授權人數 *').fill('5');
    await page.getByLabel('合約開始 *').fill('2026-09-01');
    await page.getByLabel('合約結束 *').fill('2027-08-31');
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '確認開通' }).click();
    await expect(page.getByRole('heading', { name: '開通完成' })).toBeVisible({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: '下載安全憑證函' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('沒有開通權限的角色無法使用開通頁的 API', async ({ page }) => {
    await loginAs(page, 'cs');
    const response = await page.request.get('/api/reibi/onboarding/cases');
    // The page proxies through the FastAPI host, so hit the API directly.
    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe('跨企業管理總覽', () => {
  test('新開通的企業會出現在 /reibi 企業清單', async ({ page }) => {
    const alias = uniqueAlias();
    const orgName = `E2E清單測試-${alias}`;

    await loginAs(page, 'super');
    await page.goto('/reibi/onboarding');
    await page.getByLabel('企業名稱 *').fill(orgName);
    await page.getByLabel('代碼別名（2–4 碼）*').fill(alias);
    await page.getByLabel('管理員 Email *').fill(`list-${alias.toLowerCase()}@example.test`);
    await page.getByLabel('聯絡人 *').fill('E2E 測試聯絡人');
    await page.getByLabel('授權人數 *').fill('8');
    await page.getByLabel('合約開始 *').fill('2026-09-01');
    await page.getByLabel('合約結束 *').fill('2027-08-31');
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '確認開通' }).click();
    await expect(page.getByRole('heading', { name: '開通完成' })).toBeVisible({ timeout: 30_000 });

    await page.goto('/reibi');
    await expect(page.getByText(orgName).first()).toBeVisible({ timeout: 30_000 });
    await expectNoErrorBanner(page);
  });
});
