import type { Page } from '@playwright/test';

import { randomIp } from './api.ts';

/** Use at the top of every spec: `test.use(perFileIp())`. */
export const perFileIp = () => ({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });

export const userMenu = (page: Page) => page.getByRole('button', { name: 'User menu' });

export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
	await page.goto('/auth/sign-in');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/auth/'));
}

export async function signOutViaUi(page: Page): Promise<void> {
	await userMenu(page).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL(/\/auth\/sign-in/);
}
