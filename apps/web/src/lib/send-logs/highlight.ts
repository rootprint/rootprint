import type { BundledLanguage } from 'shiki/bundle/full';

type ShikiBundle = typeof import('shiki/bundle/full');

let modulePromise: Promise<ShikiBundle> | null = null;

function loadModule(): Promise<ShikiBundle> {
	if (!modulePromise) {
		modulePromise = import('shiki/bundle/full');
	}
	return modulePromise;
}

export async function highlight(code: string, lang: BundledLanguage): Promise<string> {
	const mod = await loadModule();
	return mod.codeToHtml(code, { lang, theme: 'github-light' });
}
