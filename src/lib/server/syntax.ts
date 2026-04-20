import { type BundledLanguage, codeToHtml } from 'shiki';

export const HIGHLIGHT_THEME = 'github-light';

export type SupportedLang = BundledLanguage;

export async function highlightCode(code: string, lang: SupportedLang): Promise<string> {
	return codeToHtml(code, {
		lang,
		theme: HIGHLIGHT_THEME
	});
}
