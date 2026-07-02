import type { DecorationItem, HighlighterCore } from 'shiki/core';

/** Every language the app ever highlights: `SnippetLang` plus the JSON pane. */
export type HighlightLang = 'json' | 'bash' | 'python' | 'javascript' | 'go' | 'yaml' | 'ini';

let highlighterPromise: Promise<HighlighterCore> | null = null;

function loadHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = (async () => {
			const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
				import('shiki/core'),
				import('shiki/engine/javascript')
			]);
			return createHighlighterCore({
				themes: [import('@shikijs/themes/github-light')],
				langs: [
					import('@shikijs/langs/json'),
					import('@shikijs/langs/bash'),
					import('@shikijs/langs/python'),
					import('@shikijs/langs/javascript'),
					import('@shikijs/langs/go'),
					import('@shikijs/langs/yaml'),
					import('@shikijs/langs/ini')
				],
				engine: createJavaScriptRegexEngine()
			});
		})();
	}
	return highlighterPromise;
}

/**
 * Lazy-loads shiki on first call and returns syntax-highlighted HTML.
 * Uses the `github-light` theme to match the app's light surface.
 *
 * Pass `opts.decorations` to wrap character ranges in custom spans (shiki's
 * official decorations API) — used to mark substituted API keys.
 */
export async function highlightCode(
	code: string,
	lang: HighlightLang,
	opts?: { decorations?: DecorationItem[] }
): Promise<string> {
	const highlighter = await loadHighlighter();
	return highlighter.codeToHtml(code, {
		lang,
		theme: 'github-light',
		decorations: opts?.decorations
	});
}
