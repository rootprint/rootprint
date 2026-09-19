import { expect, test } from '@playwright/test';

import { configureOidc, idpControl, seedAdmin } from '../helpers/api.ts';
import { perFileIp } from '../helpers/ui.ts';

test.use(perFileIp());
test.beforeAll(async () => {
	const api = await seedAdmin();
	await configureOidc(api);
	await idpControl({ denyNext: true });
});

test('a provider rejection lands on sign-in with the message and no session', async ({ page }) => {
	await page.goto('/auth/sign-in');
	await page.getByRole('button', { name: 'Continue with SSO' }).click();

	await expect(page).toHaveURL(/\/auth\/sign-in\?error=access_denied/);
	await expect(page.getByRole('alert')).toHaveText('Sign-in was cancelled.');
	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name.includes('session_token'))).toBe(false);
});
