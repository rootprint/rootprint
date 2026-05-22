/**
 * Canonical level → hex color map. Single source of truth used by:
 *  - LogRow's left bar
 *  - LogFrequencyChart stacked bars
 *  - FieldPanel level dots
 *
 * Hexes are OKLCH-equalized at L≈0.62, C≈0.18 so all levels carry equal
 * perceptual weight in stacked bars. Only hue varies. Side effect: warning
 * reads as ochre/dark-amber rather than bright peach — that's intentional.
 *
 * Names are lowercased before lookup. Unknown levels fall back to `unknown`.
 */
export const LEVEL_COLORS: Record<string, string> = {
  error: '#E8463A',
  critical: '#E8463A',
  fatal: '#E8463A',
  warning: '#D4860A',
  warn: '#D4860A',
  info: '#0090D0',
  debug: '#7060C8',
  trace: '#7060C8',
  unknown: '#8B8D98',
};

export function levelColor(name: string): string {
  return LEVEL_COLORS[name.toLowerCase()] ?? LEVEL_COLORS.unknown;
}
