import { expect, test } from '@playwright/test';

import { ADMIN, resetDatabase } from '../helpers/api.ts';
import { perFileIp, userMenu } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(resetDatabase);

test('first visit walks through admin setup, then signs in', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/auth\/setup-admin/);

	await page.getByLabel('Name').fill(ADMIN.name);
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Create administrator' }).click();

	await expect(page).toHaveURL(/\/auth\/sign-in\?created=admin/);
	await expect(page.getByRole('heading', { name: 'Administrator created' })).toBeVisible();

	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();

	await page.waitForURL((u) => u.pathname === '/');
	await expect(userMenu(page)).toBeVisible();
});
