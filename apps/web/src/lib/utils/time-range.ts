import type { SearchInput, TimeRange } from '$lib/types';

export const PRESET_OPTIONS = [
  '5m',
  '15m',
  '30m',
  '1h',
  '3h',
  '6h',
  '24h',
  '3d',
  '7d',
  '30d',
] as const;
export type Preset = (typeof PRESET_OPTIONS)[number];

const PRESET_SECONDS: Record<Preset, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '3h': 3 * 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  '3d': 3 * 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
};

export function presetDurationSec(preset: string): number | null {
  return preset in PRESET_SECONDS ? PRESET_SECONDS[preset as Preset] : null;
}

export function resolveTimeRange(
  input: Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'>
): { startTs?: number; endTs?: number } {
  if (input.timeRange !== undefined) {
    const seconds = presetDurationSec(input.timeRange);
    if (seconds === null) return {};
    const endTs = Math.floor(Date.now() / 1000);
    return { startTs: endTs - seconds, endTs };
  }
  if (input.startTimestamp !== undefined && input.endTimestamp !== undefined) {
    return { startTs: input.startTimestamp, endTs: input.endTimestamp };
  }
  return {};
}

export function timeRangeDurationMs(r: TimeRange): number | null {
  if (r.type === 'relative') {
    const sec = presetDurationSec(r.preset);
    return sec === null ? null : sec * 1000;
  }
  return (r.end - r.start) * 1000;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtParts(d: Date): { md: string; hm: string } {
  return {
    md: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hm: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function formatTimeRangeLabel(r: TimeRange): string {
  if (r.type === 'relative') return r.preset;
  const start = new Date(r.start * 1000);
  const end = new Date(r.end * 1000);
  const s = fmtParts(start);
  const e = fmtParts(end);
  const sameDay = s.md === e.md && start.getFullYear() === end.getFullYear();
  return sameDay ? `${s.md} ${s.hm} → ${e.hm}` : `${s.md} ${s.hm} → ${e.md} ${e.hm}`;
}
