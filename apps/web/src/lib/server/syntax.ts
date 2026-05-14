import { type BundledLanguage, codeToHtml, type SpecialLanguage } from 'shiki';

const HIGHLIGHT_THEME = 'github-light';

type SupportedLang = BundledLanguage | SpecialLanguage;

export type CodeSnippet = {
	code: string;
	html: string;
	lang: SupportedLang;
};

export async function highlightCode(code: string, lang: SupportedLang): Promise<string> {
	return codeToHtml(code, {
		lang,
		theme: HIGHLIGHT_THEME
	});
}

const SNIPPET_CACHE = new Map<string, Promise<CodeSnippet>>();

export function snippet(code: string, lang: SupportedLang): Promise<CodeSnippet> {
	const key = `${lang}\0${code}`;
	let cached = SNIPPET_CACHE.get(key);
	if (!cached) {
		cached = highlightCode(code, lang).then((html) => ({ code, html, lang }));
		SNIPPET_CACHE.set(key, cached);
	}
	return cached;
}
