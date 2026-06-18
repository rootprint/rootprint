<script lang="ts">
	import { formatDurationSeconds, formatOrDash } from '$lib/utils/format';
	import type { ConnectionState } from '$lib/types';

	type Props = {
		state: ConnectionState;
		endpoint: string | null;
		version: string | null;
		commitHash: string | null;
		buildDate: string | null;
		uptimeSeconds: number | null;
	};

	let { state, endpoint, version, commitHash, buildDate, uptimeSeconds }: Props = $props();

	const STATE_META: Record<ConnectionState, { dot: string; label: string; text: string }> = {
		connected: { dot: 'bg-success', label: 'Connected', text: 'text-base-content' },
		connecting: { dot: 'bg-base-content/30', label: 'Connecting…', text: 'text-base-content/60' },
		disconnected: { dot: 'bg-error', label: 'Disconnected', text: 'text-error' }
	};

	const meta = $derived(STATE_META[state]);
	const uptimeText = $derived(formatOrDash(uptimeSeconds, formatDurationSeconds));
	// Strip scheme so the ribbon stays calm; full endpoint is in the title (hover).
	const endpointShort = $derived(endpoint ? endpoint.replace(/^https?:\/\//, '') : null);
	const versionTooltip = $derived.by(() => {
		const parts: string[] = [];
		if (commitHash) parts.push(`commit ${commitHash}`);
		if (buildDate) parts.push(`built ${buildDate}`);
		return parts.length > 0 ? parts.join(' · ') : null;
	});
</script>

<div
	class="border-line rounded-box flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border px-4 py-2.5"
>
	<span class="flex items-center gap-2.5">
		<span class="h-2 w-2 rounded-full {meta.dot}"></span>
		<span class="text-sm {meta.text}">{meta.label}</span>
	</span>

	<div
		class="text-base-content/40 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs {state ===
		'disconnected'
			? 'opacity-50'
			: ''}"
	>
		{#if versionTooltip}
			<span
				class="text-base-content/60 decoration-base-content/30 cursor-help font-mono underline decoration-dotted underline-offset-2"
				title={versionTooltip}>{version ?? '—'}</span
			>
		{:else}
			<span class="text-base-content/60 font-mono">{version ?? '—'}</span>
		{/if}
		<span class="text-base-content/20">·</span>
		<span class="text-base-content/60 font-mono" title={endpoint ?? undefined}
			>{endpointShort ?? '—'}</span
		>
		<span class="text-base-content/20">·</span>
		<span>up {uptimeText}</span>
	</div>
</div>
