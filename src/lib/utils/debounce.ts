export function useDebounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): { debounced: (...args: Parameters<T>) => void; cleanup: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;

	function debounced(...args: Parameters<T>) {
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
