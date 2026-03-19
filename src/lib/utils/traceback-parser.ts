// src/lib/utils/traceback-parser.ts

interface TracebackFormatter {
	detect(text: string): boolean;
	highlight(text: string): string;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const PYTHON_DETECT = /Traceback \(most recent call last\):/;

const PYTHON_FRAME =
	/^(\s+File\s+)"([^"]+)",\s+line\s+(\d+),\s+in\s+(.+)$/;

const PYTHON_EXCEPTION =
	/^([A-Za-z_][\w.]*(?:Error|Exception|Warning|Exit|Interrupt|Failure|Fault|Abort|KeyboardInterrupt|SystemExit|StopIteration|StopAsyncIteration|GeneratorExit))(?::\s*(.*))?$/;

const PYTHON_CHAINED_SEPARATORS = [
	'During handling of the above exception, another exception occurred:',
	'The above exception was the direct cause of the following exception:'
];

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

			if (PYTHON_CHAINED_SEPARATORS.some((sep) => trimmed === sep)) {
				parts.push(
					`<div class="my-3 border-l-3 border-warning bg-warning/5 px-3 py-1.5 text-[11px] text-warning">${escapeHtml(trimmed)}</div>`
				);
				continue;
			}

			if (trimmed === 'Traceback (most recent call last):') {
				parts.push(
					`<div class="text-base-content/50">${escapeHtml(trimmed)}</div>`
				);
				continue;
			}

			const frameMatch = line.match(PYTHON_FRAME);
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

			const exMatch = trimmed.match(PYTHON_EXCEPTION);
			if (exMatch && !line.startsWith('  ')) {
				const [, exType, exMsg] = exMatch;
				parts.push(
					`<div class="mt-2 rounded border-l-3 border-error bg-error/5 px-3 py-1.5">` +
						`<span class="font-semibold text-error">${escapeHtml(exType)}</span>` +
						(exMsg
							? `<span class="text-base-content/60">: ${escapeHtml(exMsg)}</span>`
							: '') +
						`</div>`
				);
				continue;
			}

			if (line.startsWith('    ') && i > 0 && lines[i - 1].match(PYTHON_FRAME)) {
				parts.push(
					`<div class="border-l-2 border-base-content/20 py-px pl-7 text-base-content/80">${escapeHtml(line.trimStart())}</div>`
				);
				continue;
			}

			if (trimmed === '') {
				parts.push('<div class="h-2"></div>');
				continue;
			}

			parts.push(
				`<div class="text-base-content/70">${escapeHtml(line)}</div>`
			);
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
