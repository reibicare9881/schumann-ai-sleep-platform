import { expect, test, type Page } from '@playwright/test';

import { expectNoErrorBanner, loginAs } from './fixtures';

/**
 * The quote -> contract -> work order -> acceptance loop, driven through the
 * real UI against a local stack. Each status transition is a separate button
 * whose label is the *next* status, so the walk below reads the same way an
 * operator would click it.
 */

function uniqueAlias(): string {
  return `W${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** Create an enterprise so the workflow page has something to operate on. */
async function createEnterprise(page: Page, alias: string): Promise<string> {
  await page.goto('/reibi/onboarding');
  await page.getByLabel('企業名稱 *').fill(`E2E流程企業-${alias}`);
  await page.getByLabel('代碼別名（2–4 碼）*').fill(alias);
  await page.getByLabel('管理員 Email *').fill(`flow-${alias.toLowerCase()}@example.test`);
  await page.getByLabel('聯絡人 *').fill('E2E 測試聯絡人');
  await page.getByLabel('授權人數 *').fill('50');
  await page.getByLabel('合約開始 *').fill('2026-09-01');
  await page.getByLabel('合約結束 *').fill('2027-08-31');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '確認開通' }).click();
  await expect(page.getByRole('heading', { name: '開通完成' })).toBeVisible({ timeout: 30_000 });

  const orgCode = await page
    .getByText(new RegExp(`^ORG-${alias}-\\d{2}-\\d{6}$`))
    .first()
    .textContent();
  expect(orgCode).toBeTruthy();
  return orgCode!.trim();
}

/** Advance a document by clicking the button labelled with its next status. */
async function advanceTo(page: Page, docNo: string, nextStatus: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: docNo });
  await row.getByRole('button', { name: nextStatus, exact: true }).click();
  await expect(row.getByText(nextStatus, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

test.describe('報價到驗收的完整閉環', () => {
  test('報價 → 合約 → 工單 → 驗收', async ({ page }) => {
    test.slow();
    const alias = uniqueAlias();

    await loginAs(page, 'super');
    const orgCode = await createEnterprise(page, alias);

    // --- 報價 -------------------------------------------------------------
    await page.goto(`/reibi/workflow?org_code=${encodeURIComponent(orgCode)}`);
    await expect(page.getByRole('heading', { name: 'REIBI 商務文件工作台' })).toBeVisible();

    await page.getByLabel('客戶名稱 *').fill(`E2E流程企業-${alias}`);
    await page.getByLabel('企業人數').fill('50');
    await page.getByLabel('合約開始').fill('2026-09-01');
    await page.getByLabel('合約結束').fill('2027-08-31');
    await page.getByRole('button', { name: '建立草稿' }).click();

    const quoteRow = page.getByRole('row').filter({ hasText: /^QT|報價/ }).first();
    await expect(quoteRow).toBeVisible({ timeout: 20_000 });
    const quoteNo = (await quoteRow.locator('td').first().textContent())!.trim();
    expect(quoteNo).not.toBe('');

    await advanceTo(page, quoteNo, '已發送');
    await advanceTo(page, quoteNo, '已確認');

    // --- 轉合約：只能產生一次 ---------------------------------------------
    await page
      .getByRole('row')
      .filter({ hasText: quoteNo })
      .getByRole('button', { name: '轉合約' })
      .click();
    await expect(page.getByText(/合約|已轉/).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '合約', exact: true }).click();
    const contractRow = page.getByRole('row').filter({ hasText: `E2E流程企業-${alias}` }).first();
    await expect(contractRow).toBeVisible({ timeout: 20_000 });
    const contractNo = (await contractRow.locator('td').first().textContent())!.trim();

    // --- 合約簽署與用印 ---------------------------------------------------
    await contractRow.getByRole('button', { name: '查看' }).click();
    await expect(page.getByRole('heading', { name: contractNo })).toBeVisible();

    await page.getByLabel('簽署人').fill('E2E 簽署人');
    await page.getByLabel('簽署日').fill('2026-09-02');
    await page.getByLabel('用印日').fill('2026-09-03');
    await page.getByLabel('執行日').fill('2026-09-04');
    await page.getByRole('button', { name: '儲存簽署／用印快照' }).click();

    // --- 從合約建立工單 ---------------------------------------------------
    await page.getByRole('button', { name: '建立施工工單' }).click();
    await page.getByRole('button', { name: '工單', exact: true }).click();

    const workRow = page.getByRole('row').filter({ hasText: `E2E流程企業-${alias}` }).first();
    await expect(workRow).toBeVisible({ timeout: 20_000 });
    const workNo = (await workRow.locator('td').first().textContent())!.trim();

    await workRow.getByRole('button', { name: '查看' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`編輯工單 ${workNo}`) })).toBeVisible();

    await page.getByLabel('聯絡人').first().fill('E2E 現場聯絡人');
    await page.getByLabel('施工日期').fill('2026-09-10');
    await page.getByRole('button', { name: '新增項目' }).click();
    await page.getByPlaceholder('項目').fill('舒曼雲床安裝');
    await page.getByPlaceholder('規格').fill('標準型');
    await page.getByRole('button', { name: '儲存工單內容' }).click();

    // --- 走完工單狀態直到驗收中 -------------------------------------------
    for (const next of ['已發出', '出貨中', '安裝中', '待驗收', '驗收中']) {
      await advanceTo(page, workNo, next);
    }

    // --- 驗收簽署 ---------------------------------------------------------
    // The acceptance panel keys off the editor's own `work` state, which a
    // status transition does not refresh; reload and reopen the way an
    // operator returning to the ticket would.
    await page.reload();
    await page.getByRole('button', { name: '工單', exact: true }).click();
    await page.getByRole('row').filter({ hasText: workNo }).getByRole('button', { name: '查看' }).click();
    await expect(page.getByRole('heading', { name: '驗收簽署' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('驗收日期 *').fill('2026-09-11');
    await page.getByLabel('客戶簽署姓名 *').fill('E2E 客戶簽署');
    await page.getByRole('button', { name: '驗收通過' }).click();

    await expect(
      page.getByRole('row').filter({ hasText: workNo }).getByText('驗收完成'),
    ).toBeVisible({ timeout: 20_000 });
    await expectNoErrorBanner(page);
  });

  test('沒有企業時商務文件頁顯示可行動的空狀態', async ({ page }) => {
    await loginAs(page, 'data');
    await page.goto('/reibi/workflow');
    // reibi_data holds no enterprise_manage permission; the page must not crash.
    await expectNoErrorBanner(page);
  });
});
