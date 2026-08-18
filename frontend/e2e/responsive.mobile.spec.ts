import { expect, test, type Page } from '@playwright/test';

import { loginAs } from './fixtures';

/**
 * Mobile acceptance for the pages an operator actually opens on a phone.
 * The property under test is that nothing forces a horizontal scroll and the
 * primary heading survives the narrow viewport — the two failures that make a
 * page unusable rather than merely cramped.
 */

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // A couple of pixels of rounding is not a layout bug.
  expect(
    overflow.scrollWidth - overflow.clientWidth,
    `${label} 出現水平捲動：scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(2);
}

const PAGES: Array<{ path: string; heading: string; label: string }> = [
  { path: '/reibi/l5', heading: 'L5 營運總覽', label: 'L5 總覽' },
  { path: '/reibi/l5/regions', heading: '區域佈點', label: '區域佈點' },
  { path: '/reibi', heading: 'REIBI', label: '跨企業管理' },
  { path: '/reibi/onboarding', heading: '新案開通', label: '新案開通' },
  { path: '/reibi/service', heading: '服務', label: '服務中心' },
  { path: '/reibi/workflow', heading: 'REIBI 商務文件工作台', label: '商務文件' },
];

test.describe('手機版可用性', () => {
  for (const { path, heading, label } of PAGES) {
    test(`${label} 在手機視窗不會水平溢出`, async ({ page }) => {
      await loginAs(page, 'super');
      await page.goto(path);
      await expect(page.getByRole('heading', { name: new RegExp(heading) }).first()).toBeVisible({
        timeout: 20_000,
      });
      await expectNoHorizontalOverflow(page, label);
    });
  }

  test('預約頁在手機視窗不會水平溢出', async ({ page }) => {
    // 預約是單位成員功能，super 沒有 orgCode 會看到阻擋畫面。
    await loginAs(page, 'member');
    await page.goto('/appointment');
    await expect(page.getByRole('heading', { name: /自主健管預約排程/ })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page, '預約排程');
  });

  test('登入表單在手機視窗可完整操作', async ({ page }) => {
    await page.goto('/reibi-login');
    const email = page.locator('input[type="email"]');
    await expect(email).toBeVisible();

    const box = await email.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    await expectNoHorizontalOverflow(page, '可信登入');
  });
});
