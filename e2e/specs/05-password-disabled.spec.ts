import { expect, test } from '@playwright/test';

import { ADMIN, configureOidc, idpControl, seedAdmin } from '../helpers/api.ts';
import { perFileIp, signOutViaUi, userMenu } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	const api = await seedAdmin();
	await configureOidc(api);
	// The IdP asserts the admin's own email, so SSO links to the admin account.
	await idpControl({
		user: { sub: 'admin-sso', email: ADMIN.email, name: ADMIN.name, email_verified: true },
		denyNext: false
	});
});

test('disabling password sign-in removes the form; an SSO admin turns it back on', async ({
	page
}) => {
	await page.goto('/auth/sign-in');
	await page.getByRole('button', { name: 'Continue with SSO' }).click();
	await expect(userMenu(page)).toBeVisible();

	await page.goto('/settings/authentication');
	const toggle = page.getByLabel('Password sign-in', { exact: true });
	await expect(toggle).toBeChecked();
	await toggle.click();
	await page.getByRole('button', { name: 'Disable', exact: true }).click();
	await expect(page.getByText('Password sign-in disabled')).toBeVisible();

	await signOutViaUi(page);
	await expect(page.getByLabel('Email')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible();

	await page.getByRole('button', { name: 'Continue with SSO' }).click();
	await expect(userMenu(page)).toBeVisible();
	await page.goto('/settings/authentication');
	await page.getByLabel('Password sign-in', { exact: true }).click();
	await expect(page.getByText('Password sign-in enabled')).toBeVisible();

	await signOutViaUi(page);
	await expect(page.getByLabel('Email')).toBeVisible();
});
