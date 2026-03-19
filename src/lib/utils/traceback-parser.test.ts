// src/lib/utils/traceback-parser.test.ts
import { describe, it, expect } from 'vitest';
import { highlightTraceback } from './traceback-parser';

const PYTHON_SIMPLE = `Traceback (most recent call last):
  File "/app/main.py", line 42, in handle_request
    result = process(data)
  File "/app/utils.py", line 10, in process
    return data["key"]
KeyError: 'key'`;

const PYTHON_CHAINED = `Traceback (most recent call last):
  File "/app/main.py", line 10, in foo
    bar()
ValueError: bad value

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/app/main.py", line 15, in baz
    foo()
RuntimeError: failed`;

const PYTHON_DIRECT_CAUSE = `Traceback (most recent call last):
  File "/app/main.py", line 10, in foo
    bar()
ValueError: bad value

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/app/main.py", line 15, in baz
    foo()
RuntimeError: failed`;

const NOT_A_TRACEBACK = `INFO: Server started on port 8080
DEBUG: Connection established`;

describe('highlightTraceback', () => {
	it('returns null for non-traceback text', () => {
		expect(highlightTraceback(NOT_A_TRACEBACK)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(highlightTraceback('')).toBeNull();
	});

	it('returns HTML for a simple Python traceback', () => {
		const result = highlightTraceback(PYTHON_SIMPLE);
		expect(result).not.toBeNull();
		expect(result).toContain('text-info');
		expect(result).toContain('text-warning');
		expect(result).toContain('text-error');
		expect(result).toContain('/app/main.py');
		expect(result).toContain('42');
		expect(result).toContain('KeyError');
	});

	it('highlights file paths in frame lines', () => {
		const result = highlightTraceback(PYTHON_SIMPLE)!;
		expect(result).toMatch(/text-info[^>]*>.*\/app\/main\.py/);
	});

	it('highlights line numbers in frame lines', () => {
		const result = highlightTraceback(PYTHON_SIMPLE)!;
		expect(result).toMatch(/text-warning[^>]*>.*42/);
	});

	it('highlights function names in frame lines', () => {
		const result = highlightTraceback(PYTHON_SIMPLE)!;
		expect(result).toContain('handle_request');
	});

	it('highlights the exception type in red', () => {
		const result = highlightTraceback(PYTHON_SIMPLE)!;
		expect(result).toMatch(/text-error[^>]*>.*KeyError/);
	});

	it('highlights chained exception separator (during handling)', () => {
		const result = highlightTraceback(PYTHON_CHAINED)!;
		expect(result).toContain('During handling of the above exception');
		expect(result).toMatch(/border-l.*warning|border-warning/);
	});

	it('highlights chained exception separator (direct cause)', () => {
		const result = highlightTraceback(PYTHON_DIRECT_CAUSE)!;
		expect(result).toContain('The above exception was the direct cause');
		expect(result).toMatch(/border-l.*warning|border-warning/);
	});

	it('handles traceback header as muted text', () => {
		const result = highlightTraceback(PYTHON_SIMPLE)!;
		expect(result).toContain('Traceback (most recent call last):');
		expect(result).toMatch(/text-base-content\/50[^>]*>.*Traceback/);
	});
});
