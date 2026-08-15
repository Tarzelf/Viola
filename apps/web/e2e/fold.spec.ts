import { expect, test } from '@playwright/test';

/**
 * The Fold has to be as public as a share page. An auth wall in front of
 * "every look at once" would be a strange way to hide the product.
 */
test('the Fold is a public room', async ({ page }) => {
  await page.goto('/fold');
  await expect(page.getByRole('heading', { name: /every look exists/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Moments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scenarios' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return' })).toBeVisible();
});
