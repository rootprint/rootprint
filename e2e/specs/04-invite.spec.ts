import { expect, test } from '@playwright/test';

import { ADMIN, seedAdmin } from '../helpers/api.ts';
import { perFileIp, signInViaUi, signOutViaUi, userMenu } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	await seedAdmin();
});

test('admin invites a member, who sets a password and signs in', async ({ page }) => {
	await signInViaUi(page, ADMIN.email, ADMIN.password);
	await page.goto('/settings/users');
	await page.getByRole('button', { name: 'Create user' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Mia Member');
	await page.getByLabel('Email', { exact: true }).fill('mia@example.com');
	await page.getByRole('button', { name: 'Create & get link' }).click();

	const link = await page.getByLabel('Invite link', { exact: true }).inputValue();
	expect(link).toContain('/auth/setup?token=');
	await page.getByRole('button', { name: 'Done' }).click();

	await signOutViaUi(page);
	await page.goto(link);
	await page.getByLabel('Password', { exact: true }).fill('member-password-123');
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(page).toHaveURL(/\/auth\/sign-in/);

	await signInViaUi(page, 'mia@example.com', 'member-password-123');
	await userMenu(page).click();
	await expect(page.locator('[popover]').getByText('mia@example.com')).toBeVisible();
});
