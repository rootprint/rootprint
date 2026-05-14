export function useDebounce<Args extends unknown[], R>(
	fn: (...args: Args) => R,
	delay: number
): { debounced: (...args: Args) => void; cleanup: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;

	function debounced(...args: Args) {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	}

	function cleanup() {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	return { debounced, cleanup };
}
