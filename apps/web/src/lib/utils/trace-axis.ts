const TICK_TARGET = 6;

export interface TraceAxis {
	ticks: { pct: number; label: string }[];
	gridStyle: string;
}

function niceStep(raw: number): number {
	const pow = 10 ** Math.floor(Math.log10(raw));
	const frac = raw / pow;
	return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
}

/**
 * Unit from the largest value a label carries, not the window width — zoomed into the tail of a long
 * trace those differ by orders of magnitude, and sizing on the window renders "1333000000.0µs" where
 * "1333.0002s" is meant. Decimals track the step, or a step finer than the unit renders every label
 * identically.
 */
function tickFormatter(maxValueMicros: number, stepMicros: number): (n: number) => string {
	let div = 1;
	let suffix = 'µs';
	if (maxValueMicros >= 1_000_000) {
		div = 1_000_000;
		suffix = 's';
	} else if (maxValueMicros >= 1_000) {
		div = 1_000;
		suffix = 'ms';
	}
	const stepInUnit = stepMicros / div;
	const decimals = Math.max(0, Math.min(9, Math.ceil(-Math.log10(stepInUnit))));
	return (n) => `${(n / div).toFixed(decimals)}${suffix}`;
}

/** `startMicros` offsets the labels only, so a zoomed view still reads in trace time. */
export function traceAxis(totalMicros: number, startMicros = 0): TraceAxis {
	if (totalMicros <= 0) return { ticks: [], gridStyle: '' };

	const step = niceStep(totalMicros / TICK_TARGET);
	const format = tickFormatter(startMicros + totalMicros, step);
	const ticks: { pct: number; label: string }[] = [];
	for (let t = 0; t <= totalMicros; t += step) {
		ticks.push({ pct: (t / totalMicros) * 100, label: format(startMicros + t) });
	}

	// content-box origin and clip are load-bearing: ticks and bars are positioned in the content
	// box, so a gradient on the padding box drifts by the track's `pr-14` (~56px) at the right edge.
	const gridStyle =
		'background-origin:content-box;background-clip:content-box;' +
		'background-image:repeating-linear-gradient(to right,var(--color-line) 0 1px,transparent 1px ' +
		`${(step / totalMicros) * 100}%)`;

	return { ticks, gridStyle };
}
