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

/** Decimals track the tick step: a 0.5ms step at 0 decimals renders "0ms 1ms 1ms 2ms". */
function tickFormatter(totalMicros: number, stepMicros: number): (n: number) => string {
	let div = 1;
	let suffix = 'µs';
	if (totalMicros >= 1_000_000) {
		div = 1_000_000;
		suffix = 's';
	} else if (totalMicros >= 1_000) {
		div = 1_000;
		suffix = 'ms';
	}
	const stepInUnit = stepMicros / div;
	const decimals = Math.max(0, Math.min(2, Math.ceil(-Math.log10(stepInUnit))));
	return (n) => `${(n / div).toFixed(decimals)}${suffix}`;
}

export function traceAxis(totalMicros: number): TraceAxis {
	if (totalMicros <= 0) return { ticks: [], gridStyle: '' };

	const step = niceStep(totalMicros / TICK_TARGET);
	const format = tickFormatter(totalMicros, step);
	const ticks: { pct: number; label: string }[] = [];
	for (let t = 0; t <= totalMicros; t += step) {
		ticks.push({ pct: (t / totalMicros) * 100, label: format(t) });
	}

	// content-box origin and clip are load-bearing: ticks and bars are positioned in the content
	// box, so a gradient on the padding box drifts by the track's `pr-14` (~56px) at the right edge.
	const gridStyle =
		'background-origin:content-box;background-clip:content-box;' +
		'background-image:repeating-linear-gradient(to right,var(--color-line) 0 1px,transparent 1px ' +
		`${(step / totalMicros) * 100}%)`;

	return { ticks, gridStyle };
}
