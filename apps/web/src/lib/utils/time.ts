import { format, formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import type { TimezoneMode } from '$lib/types';

function formatTs(tsSec: number, timezone: TimezoneMode, pattern: string): string {
  const ms = tsSec * 1000;
  return timezone === 'utc' ? formatInTimeZone(ms, 'UTC', pattern) : format(ms, pattern);
}

/** "HH:MM" */
export function formatChartTime(tsSec: number, timezone: TimezoneMode): string {
  return formatTs(tsSec, timezone, 'HH:mm');
}

/** "MM-DD HH:MM" */
export function formatChartDate(tsSec: number, timezone: TimezoneMode): string {
  return formatTs(tsSec, timezone, 'MM-dd HH:mm');
}

/** "YYYY-MM-DD HH:MM:SS" */
export function formatChartTooltip(tsSec: number, timezone: TimezoneMode): string {
  return formatTs(tsSec, timezone, 'yyyy-MM-dd HH:mm:ss');
}

/** "YYYY-MM-DD HH:MM:SS.SSS" — used in the log row timestamp column. */
export function formatLogRowTimestamp(iso: string, timezone: TimezoneMode): string {
  const tsSec = new Date(iso).getTime() / 1000;
  return formatTs(tsSec, timezone, 'yyyy-MM-dd HH:mm:ss.SSS');
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}
