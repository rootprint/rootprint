import { formatDistanceToNow } from 'date-fns';

export function formatRelativeTime(date: Date): string {
	return formatDistanceToNow(date, { addSuffix: true });
}
