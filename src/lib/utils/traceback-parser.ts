import type { TracebackFormatter } from '$lib/types';

function escapeHtml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

const PYTHON_DETECT = /Traceback \(most recent call last\):/;

const PYTHON_FRAME = /^(\s+File\s+)"([^"]+)",\s+line\s+(\d+),\s+in\s+(.+)$/;

// Split into a simple line-shape regex plus a non-backtracking suffix check.
// Combining `[\w.]*` with a word-class alternation tail in one pattern triggers
// quadratic backtracking on long non-matching input.
const PYTHON_EXCEPTION_LINE = /^([A-Za-z_][\w.]*)(?::\s*(.*))?$/;
const PYTHON_EXCEPTION_SUFFIX = /(?:Error|Exception|Warning|Exit|Interrupt|Failure|Fault|Abort)$/;
const PYTHON_EXCEPTION_EXACT = new Set(['StopIteration', 'StopAsyncIteration']);

function isPythonExceptionType(typeName: string): boolean {
	if (PYTHON_EXCEPTION_SUFFIX.test(typeName)) return true;
	const dot = typeName.lastIndexOf('.');
	const last = dot === -1 ? typeName : typeName.slice(dot + 1);
	return PYTHON_EXCEPTION_EXACT.has(last);
}

const PYTHON_CHAINED_SEPARATORS = new Set([
	'During handling of the above exception, another exception occurred:',
	'The above exception was the direct cause of the following exception:'
]);

const pythonFormatter: TracebackFormatter = {
	detect(text: string): boolean {
		return PYTHON_DETECT.test(text);
	},

	highlight(text: string): string {
		const lines = text.split('\n');
		const parts: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			if (PYTHON_CHAINED_SEPARATORS.has(trimmed)) {
				parts.push(
					`<div class="my-3 border-l-3 border-warning bg-warning/5 px-3 py-1.5 text-[11px] text-warning">${escapeHtml(trimmed)}</div>`
				);
				continue;
			}

			if (trimmed === 'Traceback (most recent call last):') {
				parts.push(`<div class="text-base-content/50">${escapeHtml(trimmed)}</div>`);
				continue;
			}

			const frameMatch = PYTHON_FRAME.exec(line);
			if (frameMatch) {
				const [, prefix, filePath, lineNum, funcName] = frameMatch;
				parts.push(
					`<div class="border-l-2 border-base-content/20 py-px pl-3">` +
						`<span class="text-base-content/40">${escapeHtml(prefix.trim())} "</span>` +
						`<span class="text-info">${escapeHtml(filePath)}</span>` +
						`<span class="text-base-content/40">", line </span>` +
						`<span class="text-warning">${escapeHtml(lineNum)}</span>` +
						`<span class="text-base-content/40">, in </span>` +
						`<span class="text-[#b294bb]">${escapeHtml(funcName)}</span>` +
						`</div>`
				);
				continue;
			}

			const exMatch = PYTHON_EXCEPTION_LINE.exec(trimmed);
			if (exMatch && !line.startsWith('  ') && isPythonExceptionType(exMatch[1])) {
				const [, exType, exMsg] = exMatch;
				parts.push(
					`<div class="mt-2 rounded border-l-3 border-error bg-error/5 px-3 py-1.5">` +
						`<span class="font-semibold text-error">${escapeHtml(exType)}</span>` +
						(exMsg ? `<span class="text-base-content/60">: ${escapeHtml(exMsg)}</span>` : '') +
						`</div>`
				);
				continue;
			}

			if (line.startsWith('    ') && i > 0 && PYTHON_FRAME.exec(lines[i - 1])) {
				parts.push(
					`<div class="border-l-2 border-base-content/20 py-px pl-7 text-base-content/80">${escapeHtml(line.trimStart())}</div>`
				);
				continue;
			}

			if (trimmed === '') {
				parts.push('<div class="h-2"></div>');
				continue;
			}

			parts.push(`<div class="text-base-content/70">${escapeHtml(line)}</div>`);
		}

		return parts.join('\n');
	}
};

const formatters: TracebackFormatter[] = [pythonFormatter];

export function highlightTraceback(text: string): string | null {
	for (const f of formatters) {
		if (f.detect(text)) return f.highlight(text);
	}
	return null;
}
