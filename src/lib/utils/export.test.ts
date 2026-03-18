import { describe, it, expect } from 'vitest';
import { formatAsJson, formatAsCsv, formatAsText } from './export';

describe('formatAsJson', () => {
	it('formats an array of logs as pretty JSON', () => {
		const logs = [{ timestamp: 1711036800, level: 'info', message: 'hello' }];
		const result = formatAsJson(logs);
		expect(JSON.parse(result)).toEqual(logs);
		expect(result).toContain('\n'); // pretty-printed
	});

	it('returns empty array for no logs', () => {
		expect(formatAsJson([])).toBe('[]');
	});

	it('preserves nested objects', () => {
		const logs = [{ meta: { user: { id: 1 } } }];
		const result = formatAsJson(logs);
		expect(JSON.parse(result)).toEqual(logs);
	});
});

describe('formatAsCsv', () => {
	it('creates CSV with headers from union of all fields', () => {
		const logs = [
			{ timestamp: 1, level: 'info', message: 'a', service: 'api' },
			{ timestamp: 2, level: 'error', message: 'b', host: 'web1' }
		];
		const result = formatAsCsv(logs);
		const lines = result.split('\n');
		// timestamp, level, message first; then host, service alphabetical
		expect(lines[0]).toBe('timestamp,level,message,host,service');
		expect(lines.length).toBe(3); // header + 2 rows
	});

	it('produces empty cells for missing fields', () => {
		const logs = [
			{ timestamp: 1, level: 'info', message: 'a' },
			{ timestamp: 2, level: 'error', message: 'b', extra: 'val' }
		];
		const result = formatAsCsv(logs);
		const lines = result.split('\n');
		// First row should have empty cell for 'extra'
		expect(lines[1]).toBe('1,info,a,');
		expect(lines[2]).toBe('2,error,b,val');
	});

	it('escapes values containing commas', () => {
		const logs = [{ timestamp: 1, level: 'info', message: 'hello, world' }];
		const result = formatAsCsv(logs);
		expect(result).toContain('"hello, world"');
	});

	it('escapes values containing double quotes', () => {
		const logs = [{ timestamp: 1, level: 'info', message: 'say "hi"' }];
		const result = formatAsCsv(logs);
		expect(result).toContain('"say ""hi"""');
	});

	it('escapes values containing newlines', () => {
		const logs = [{ timestamp: 1, level: 'info', message: 'line1\nline2' }];
		const result = formatAsCsv(logs);
		expect(result).toContain('"line1\nline2"');
	});

	it('JSON-stringifies nested objects', () => {
		const logs = [{ timestamp: 1, level: 'info', message: 'a', meta: { key: 'val' } }];
		const result = formatAsCsv(logs);
		// nested object should be stringified and escaped
		expect(result).toContain('"{""key"":""val""}"');
	});

	it('returns empty string for no logs', () => {
		expect(formatAsCsv([])).toBe('');
	});
});

describe('formatAsText', () => {
	it('formats log as timestamp [level] key=value message', () => {
		const logs = [{ ts: 1711036800, sev: 'info', msg: 'hello', service: 'api' }];
		const result = formatAsText(logs, 'ts', 'sev', 'msg');
		expect(result).toBe('1711036800 [info] service=api hello');
	});

	it('handles missing level gracefully', () => {
		const logs = [{ ts: 1711036800, msg: 'hello' }];
		const result = formatAsText(logs, 'ts', 'level', 'msg');
		expect(result).toBe('1711036800 [unknown] hello');
	});

	it('handles missing timestamp gracefully', () => {
		const logs = [{ level: 'info', message: 'hello' }];
		const result = formatAsText(logs, 'timestamp', 'level', 'message');
		expect(result).toBe(' [info] hello');
	});

	it('includes all extra fields except timestamp, level, message', () => {
		const logs = [{ ts: 1, lv: 'warn', msg: 'x', a: 'one', b: 'two' }];
		const result = formatAsText(logs, 'ts', 'lv', 'msg');
		expect(result).toBe('1 [warn] a=one b=two x');
	});

	it('returns empty string for no logs', () => {
		expect(formatAsText([], 'ts', 'lv', 'msg')).toBe('');
	});

	it('handles multiple logs', () => {
		const logs = [
			{ ts: 1, lv: 'info', msg: 'first' },
			{ ts: 2, lv: 'error', msg: 'second' }
		];
		const result = formatAsText(logs, 'ts', 'lv', 'msg');
		const lines = result.split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[0]).toBe('1 [info] first');
		expect(lines[1]).toBe('2 [error] second');
	});
});
