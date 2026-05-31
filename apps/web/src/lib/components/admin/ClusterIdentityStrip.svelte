<script lang="ts">
	import { formatDurationSeconds } from '$lib/utils/format';

	type HealthState = 'healthy' | 'unhealthy' | 'unreachable' | 'loading';

	type Props = {
		state: HealthState;
		endpoint: string | null;
		version: string | null;
		uptimeSeconds: number | null;
	};

	let { state, endpoint, version, uptimeSeconds }: Props = $props();

	const STATE_META: Record<HealthState, { dot: string; label: string }> = {
		healthy: { dot: 'bg-success', label: 'healthy' },
		unhealthy: { dot: 'bg-warning', label: 'unhealthy' },
		unreachable: { dot: 'bg-error', label: 'unreachable' },
		loading: { dot: 'bg-base-content/30', label: 'checking…' }
	};

	const meta = $derived(STATE_META[state]);
	const uptimeText = $derived(uptimeSeconds === null ? '—' : formatDurationSeconds(uptimeSeconds));
</script>

<div
	class="border-line text-base-content/70 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 border px-4 py-2 text-xs"
>
	<span class="flex items-center gap-2">
		<span class="h-2 w-2 rounded-full {meta.dot}"></span>
		<span class="text-base-content">{meta.label}</span>
	</span>
	<span class="text-base-content/30">|</span>
	<span>
		<span class="text-base-content/50">quickwit</span>
		<span class="font-mono">{version ?? '—'}</span>
	</span>
	<span class="text-base-content/30">|</span>
	<span class="min-w-0 truncate">
		<span class="text-base-content/50">endpoint</span>
		<span class="font-mono">{endpoint ?? '—'}</span>
	</span>
	<span class="text-base-content/30">|</span>
	<span>
		<span class="text-base-content/50">uptime</span>
		<span class="font-mono">{uptimeText}</span>
	</span>
</div>
