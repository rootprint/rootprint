import type { BundledLanguage } from 'shiki/bundle/full';

type ShikiBundle = typeof import('shiki/bundle/full');

let modulePromise: Promise<ShikiBundle> | null = null;

function loadModule(): Promise<ShikiBundle> {
  if (!modulePromise) {
    modulePromise = import('shiki/bundle/full');
  }
  return modulePromise;
}

/**
 * Lazy-loads shiki on first call and returns syntax-highlighted HTML.
 * Uses the `github-light` theme to match the app's light surface.
 */
export async function highlightCode(code: string, lang: BundledLanguage): Promise<string> {
  const mod = await loadModule();
  return mod.codeToHtml(code, { lang, theme: 'github-light' });
}
