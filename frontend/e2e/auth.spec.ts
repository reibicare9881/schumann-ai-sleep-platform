import { expect, test } from '@playwright/test';

import { ACCOUNTS, E2E_PASSWORD, loginAs } from './fixtures';

test.describe('可信帳號登入', () => {
  test('正確憑證可登入並導向儀表板', async ({ page }) => {
    await loginAs(page, 'super');
    expect(page.url()).toContain('/dashboard');
  });

  test('錯誤密碼顯示錯誤訊息且停留在登入頁', async ({ page }) => {
    await page.goto('/reibi-login');
    await page.locator('input[type="email"]').fill(ACCOUNTS.super.email);
    await page.locator('input[type="password"]').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: '安全登入' }).click();

    await expect(page.getByText(/不正確|登入失敗/)).toBeVisible();
    expect(page.url()).toContain('/reibi-login');
  });

  test('未註冊的 Email 不會洩漏帳號是否存在', async ({ page }) => {
    await page.goto('/reibi-login');
    await page.locator('input[type="email"]').fill('nobody-here@example.test');
    await page.locator('input[type="password"]').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: '安全登入' }).click();

    const message = await page.getByText(/不正確|登入失敗/).first().textContent();
    expect(message).not.toMatch(/不存在|not found|no such user/i);
  });

  test('未登入直接開啟受保護頁面會被導回登入頁', async ({ page }) => {
    await page.goto('/reibi/l5');
    await page.waitForURL('**/login', { timeout: 20_000 });
    expect(page.url()).toContain('/login');
  });

  test('登出後受保護頁面不再可用', async ({ page }) => {
    await loginAs(page, 'super');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/reibi/l5');
    await page.waitForURL('**/login', { timeout: 20_000 });
    expect(page.url()).toContain('/login');
  });

  test('瀏覽器不會取得 Supabase service role 或 refresh token', async ({ page }) => {
    await loginAs(page, 'super');
    const storageDump = await page.evaluate(() =>
      Object.keys(localStorage)
        .map(key => `${key}=${localStorage.getItem(key)}`)
        .join('\n'),
    );

    expect(storageDump).not.toContain('service_role');
    expect(storageDump).not.toContain('refresh_token');
    // The local service-role key's signature; must never reach the browser.
    expect(storageDump).not.toContain('EGIM96RAZx35lJzdJsyH');
  });
});
