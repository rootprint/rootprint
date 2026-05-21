import { LEVEL_TOKEN_MAP, SEVERITY_ORDER } from '$lib/constants/severity';

/** Empty string in non-browser contexts (SSR/test). */
export function getLevelColor(level: string): string {
  if (typeof document === 'undefined') return '';
  const style = getComputedStyle(document.documentElement);
  const normalized = level.toLowerCase();
  const token = LEVEL_TOKEN_MAP[normalized] ?? normalized;
  return (
    style.getPropertyValue(`--level-${token}`).trim() ||
    style.getPropertyValue('--level-unknown').trim()
  );
}

const SEVERITY_ORDER_INDEX = new Map<string, number>(
  SEVERITY_ORDER.map((v, i) => [v, i])
);

/** Unknown values sort to the end, preserving their input order. */
export function sortBySeverity(values: string[]): string[] {
  return values.toSorted((a, b) => {
    const ai = SEVERITY_ORDER_INDEX.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
    const bi = SEVERITY_ORDER_INDEX.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
    return ai - bi;
  });
}

export function severityDotClass(severity: string): string {
  const canonical = LEVEL_TOKEN_MAP[severity] ?? severity;
  switch (canonical) {
    case 'error':
    case 'critical':
      return 'bg-error';
    case 'warning':
      return 'bg-warning';
    case 'info':
      return 'bg-info';
    case 'debug':
      return 'bg-base-content/40';
    default:
      return 'bg-base-content/20';
  }
}

/** uPlot needs a concrete CSS color string, not a `var(--...)`. */
export function baseContentAt(alpha: number): string {
  if (typeof document === 'undefined') return '';
  const v =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-base-content')
      .trim() || '#0a0a0a';
  return `color-mix(in oklab, ${v} ${Math.round(alpha * 100)}%, transparent)`;
}
