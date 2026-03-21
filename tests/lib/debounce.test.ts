import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce } from '../../src/lib/utils/debounce';

describe('useDebounce', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('calls the function after the delay', () => {
		const fn = vi.fn();
		const { debounced } = useDebounce(fn, 300);

		debounced('a');
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledWith('a');
	});

	it('cancels previous call when called again', () => {
		const fn = vi.fn();
		const { debounced } = useDebounce(fn, 300);

		debounced('a');
		vi.advanceTimersByTime(200);
		debounced('b');
		vi.advanceTimersByTime(300);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('b');
	});

	it('cleanup cancels pending call', () => {
		const fn = vi.fn();
		const { debounced, cleanup } = useDebounce(fn, 300);

		debounced('a');
		cleanup();
		vi.advanceTimersByTime(300);

		expect(fn).not.toHaveBeenCalled();
	});

	it('works after cleanup and re-creation', () => {
		const fn = vi.fn();
		const { debounced, cleanup } = useDebounce(fn, 300);

		debounced('a');
		cleanup();

		debounced('b');
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledWith('b');
	});
});
