import { expect, test } from '@playwright/test';

import { ADMIN, IDP, idpControl, seedAdmin } from '../helpers/api.ts';
import { perFileIp, signInViaUi, signOutViaUi, userMenu } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	await seedAdmin();
	await idpControl({
		user: { sub: 'sso-1', email: 'sso@example.com', name: 'Sso User', email_verified: true },
		denyNext: false,
		discovery: {}
	});
});

test('admin configures OIDC in settings; a new user signs in with SSO', async ({ page }) => {
	await signInViaUi(page, ADMIN.email, ADMIN.password);

	await page.goto('/settings/authentication/oidc');
	await page.getByLabel('Issuer URL').fill(IDP);
	await page.getByLabel('Client ID').fill('rootprint');
	await page.getByLabel('Client Secret').fill('oidc-secret');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('OpenID Connect authentication settings saved')).toBeVisible();

	await signOutViaUi(page);
	await page.getByRole('button', { name: 'Continue with SSO' }).click();

	await page.waitForURL((u) => u.pathname === '/');
	await userMenu(page).click();
	await expect(page.locator('[popover]').getByText('sso@example.com')).toBeVisible();
});
