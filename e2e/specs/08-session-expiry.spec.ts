import { expect, test } from '@playwright/test';

import { ADMIN, expireAllSessions, seedAdmin } from '../helpers/api.ts';
import { perFileIp, signInViaUi } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	await seedAdmin();
});

test('an expired session redirects to sign-in and keeps the return path', async ({ page }) => {
	await signInViaUi(page, ADMIN.email, ADMIN.password);
	await page.goto('/settings/profile');
	await expect(page).toHaveURL(/\/settings\/profile$/);

	await expireAllSessions();
	await page.goto('/settings/profile');
	await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=%2Fsettings%2Fprofile/);
});
