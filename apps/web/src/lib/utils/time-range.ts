import type { SearchInput } from '$lib/types';

const PRESET_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
};

export function resolveTimeRange(
  input: Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'>
): { startTs?: number; endTs?: number } {
  if (input.timeRange !== undefined) {
    const seconds = PRESET_SECONDS[input.timeRange];
    if (seconds === undefined) return {};
    const endTs = Math.floor(Date.now() / 1000);
    return { startTs: endTs - seconds, endTs };
  }
  if (input.startTimestamp !== undefined && input.endTimestamp !== undefined) {
    return { startTs: input.startTimestamp, endTs: input.endTimestamp };
  }
  return {};
}
