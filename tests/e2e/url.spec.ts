import { expect, test } from '@playwright/test';

test('network address field converts and exposes HTML and JSON downloads', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('网络 DOCX 地址').fill('http://127.0.0.1:4173/sample.docx');
  await page.getByRole('button', { name: '转换网络文档' }).click();
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#download')).toBeEnabled();
  await expect(page.locator('#json')).toBeEnabled();
  await expect(page.frameLocator('#preview').getByRole('heading', { name: '文档转换 · 能力示例', exact: true })).toBeVisible();
});
