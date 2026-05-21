import { LEVEL_TOKEN_MAP, SEVERITY_ORDER } from '$lib/constants/severity';

const SEVERITY_ORDER_INDEX = new Map<string, number>(
  SEVERITY_ORDER.map((v, i) => [v, i])
);

/**
 * Sort an array of severity names by canonical severity order.
 * Unknown values sort to the end, preserving relative order among themselves.
 */
export function sortBySeverity(values: string[]): string[] {
  return values.toSorted((a, b) => {
    const ai = SEVERITY_ORDER_INDEX.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
    const bi = SEVERITY_ORDER_INDEX.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
    return ai - bi;
  });
}

/**
 * Tailwind class for a severity dot. Uses DaisyUI semantic colors so the
 * dot follows the theme — no `--level-*` CSS variables required.
 */
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
