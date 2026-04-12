import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const searchToolbarPath = path.resolve(
	process.cwd(),
	'src/lib/components/search/SearchToolbar.svelte'
);
const searchToolbarSource = readFileSync(searchToolbarPath, 'utf8');

describe('SearchToolbar wrap toggle', () => {
	it('renders wrap toggle as an icon-only square button', () => {
		const wrapToggleButtonMatch = searchToolbarSource.match(
			/<button[\s\S]*?aria-label="Toggle line wrapping"[\s\S]*?<\/button>/
		);

		expect(wrapToggleButtonMatch).not.toBeNull();

		const wrapToggleButton = wrapToggleButtonMatch?.[0] ?? '';

		expect(wrapToggleButton).toContain('btn-square');
		expect(wrapToggleButton).toContain('aria-label="Toggle line wrapping"');
		expect(wrapToggleButton).toContain('title="Toggle line wrapping"');
		expect(wrapToggleButton).toContain("aria-pressed={wrapMode === 'wrap'}");
		expect(wrapToggleButton).toContain('<TextWrap size={14} />');
		expect(wrapToggleButton).not.toContain('Wrap lines');
	});
});
