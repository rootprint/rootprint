import { expect, test } from '@playwright/test';

import { ADMIN, seedAdmin } from '../helpers/api.ts';
import { perFileIp, signInViaUi, signOutViaUi } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	await seedAdmin();
});

test('sign-out clears the cookie and back navigation does not restore the session', async ({
	page
}) => {
	await signInViaUi(page, ADMIN.email, ADMIN.password);
	await page.goto('/settings/profile');
	await signOutViaUi(page);

	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name.includes('session_token'))).toBe(false);

	await page.goBack();
	await expect(page).toHaveURL(/\/auth\/sign-in/);
});
