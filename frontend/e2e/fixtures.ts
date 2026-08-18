import { expect, type Page } from '@playwright/test';

/**
 * Accounts created by `backend/tests/e2e_seed.py` against the local Supabase.
 * Passwords are local-only fixtures for a database recreated by `db:reset`.
 */
export const ACCOUNTS = {
  super: { email: 'e2e-super@example.test', role: 'reibi_super', label: '超級管理者' },
  finance: { email: 'e2e-finance@example.test', role: 'reibi_finance', label: '財務管理員' },
  cs: { email: 'e2e-cs@example.test', role: 'reibi_cs', label: '客服管理員' },
  data: { email: 'e2e-data@example.test', role: 'reibi_data', label: '數據分析師' },
  member: { email: 'e2e-member@example.test', role: 'member', label: '單位成員' },
} as const;

export const E2E_PASSWORD = 'e2e-local-fixture-password-2026';

export type AccountKey = keyof typeof ACCOUNTS;

/** Sign in through the real trusted-login form and wait for the redirect. */
export async function loginAs(page: Page, account: AccountKey): Promise<void> {
  await page.goto('/reibi-login');
  await page.locator('input[type="email"]').fill(ACCOUNTS[account].email);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '安全登入' }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

/** Read the application session the browser stores after a successful login. */
export async function readSession(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw || !raw.includes('access_token')) continue;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });
}

/** Fail the test if the page is showing an unexpected error surface. */
export async function expectNoErrorBanner(page: Page): Promise<void> {
  await expect(page.locator('text=Application error')).toHaveCount(0);
  await expect(page.locator('text=Internal Server Error')).toHaveCount(0);
}
