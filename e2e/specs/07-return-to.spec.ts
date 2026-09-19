import { expect, test } from '@playwright/test';

import { ADMIN, BASE, seedAdmin } from '../helpers/api.ts';
import { perFileIp } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	await seedAdmin();
});

test('a deep link survives the sign-in redirect', async ({ page }) => {
	// Known bug: routes/auth/+layout.ts redirects a signed-in visitor on /auth/sign-in to '/',
	// and the sign-in page's invalidate(DEP.session) re-runs that layout before goto(returnTo),
	// so the deep link is lost. Remove this marker when the redirect honours returnTo.
	test.fail(true, 'return-to is lost on password sign-in');

	await page.goto('/settings/profile');
	await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=%2Fsettings%2Fprofile/);

	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();

	await expect(page).toHaveURL(`${BASE}/settings/profile`);
});
