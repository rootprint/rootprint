import type { Attachment } from 'svelte/attachments';

const HIGHLIGHT_NAME = 'rootprint-drawer-search';

interface TextSpan {
	node: Text;
	start: number;
}

function locate(
	spans: TextSpan[],
	offset: number,
	isEnd: boolean
): { node: Text; offset: number } | null {
	for (const span of spans) {
		const spanEnd = span.start + span.node.length;
		const within = isEnd
			? offset > span.start && offset <= spanEnd
			: offset >= span.start && offset < spanEnd;
		if (within) return { node: span.node, offset: offset - span.start };
	}
	return null;
}

function collectHighlightRanges(root: Node, term: string): Range[] {
	if (!term) return [];
	const doc = root.ownerDocument ?? document;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	const spans: TextSpan[] = [];
	let full = '';
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node.nodeValue ?? '';
		if (text.length === 0) continue;
		spans.push({ node: node as Text, start: full.length });
		full += text;
	}
	if (full.length === 0) return [];

	const haystack = full.toLowerCase();
	const needle = term.toLowerCase();
	const ranges: Range[] = [];
	for (
		let idx = haystack.indexOf(needle);
		idx !== -1;
		idx = haystack.indexOf(needle, idx + needle.length)
	) {
		const start = locate(spans, idx, false);
		const end = locate(spans, idx + needle.length, true);
		if (!start || !end) continue;
		const range = doc.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset);
		ranges.push(range);
	}
	return ranges;
}

export function searchHighlight(getTerm: () => string): Attachment<HTMLElement> {
	return (node) => {
		const supported =
			typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
		if (!supported) return;

		let frame = 0;

		function apply(): void {
			const ranges = collectHighlightRanges(node, getTerm());
			if (ranges.length > 0) {
				CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
			} else {
				CSS.highlights.delete(HIGHLIGHT_NAME);
			}
		}

		function schedule(): void {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				apply();
			});
		}

		const observer = new MutationObserver(schedule);
		observer.observe(node, { subtree: true, childList: true, characterData: true });

		$effect(() => {
			getTerm();
			schedule();
		});

		return () => {
			observer.disconnect();
			if (frame !== 0) cancelAnimationFrame(frame);
			CSS.highlights.delete(HIGHLIGHT_NAME);
		};
	};
}
