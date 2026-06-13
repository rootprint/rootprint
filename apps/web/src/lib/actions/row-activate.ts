import type { Action } from 'svelte/action';

const MOVE_THRESHOLD = 6;

export const rowActivate: Action<HTMLElement, () => void> = (node, onActivate) => {
	let activate = onActivate;
	let downX = 0;
	let downY = 0;

	function handlePointerDown(event: PointerEvent) {
		downX = event.clientX;
		downY = event.clientY;
	}

	function handleClick(event: MouseEvent) {
		if (Math.hypot(event.clientX - downX, event.clientY - downY) >= MOVE_THRESHOLD) return;
		activate();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activate();
		}
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('click', handleClick);
	node.addEventListener('keydown', handleKeyDown);

	return {
		update(next: () => void) {
			activate = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('click', handleClick);
			node.removeEventListener('keydown', handleKeyDown);
		}
	};
};
