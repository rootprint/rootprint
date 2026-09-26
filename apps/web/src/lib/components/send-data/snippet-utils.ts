import type { DecorationItem } from 'shiki/bundle/full';
import type { IntegrationContext } from './types';

export function apiKeyDecorations(code: string, value: string): DecorationItem[] {
	if (!value) return [];
	const decorations: DecorationItem[] = [];
	let from = 0;
	for (;;) {
		const start = code.indexOf(value, from);
		if (start === -1) break;
		decorations.push({
			start,
			end: start + value.length,
			properties: { class: 'api-key-substituted' }
		});
		from = start + value.length;
	}
	return decorations;
}

export function highlightKey(
	ctx: Pick<IntegrationContext, 'apiKey' | 'hasRealApiKey'>
): string | undefined {
	return ctx.hasRealApiKey ? ctx.apiKey : undefined;
}
