<script lang="ts">
	import type { ConnectionState } from '#lib/types.js';

	type Props = {
		state: ConnectionState;
		endpoint: string | null;
		version: string | null;
		commitHash: string | null;
		buildDate: string | null;
		clusterId: string | null;
		liveNodes: number | null;
		deadNodes: number | null;
	};

	let { state, endpoint, version, commitHash, buildDate, clusterId, liveNodes, deadNodes }: Props =
		$props();

	const STATE_META: Record<ConnectionState, { dot: string; label: string; text: string }> = {
		connected: { dot: 'status-success', label: 'Connected', text: 'text-base-content' },
		connecting: { dot: '', label: 'Connecting…', text: 'text-muted' },
		disconnected: { dot: 'status-error', label: 'Disconnected', text: 'text-error' }
	};

	const meta = $derived(STATE_META[state]);
	// Strip scheme so the ribbon stays calm; full endpoint is in the title (hover).
	const endpointShort = $derived(endpoint?.replace(/^https?:\/\//, ''));
	const versionTooltip = $derived(
		[commitHash && `commit ${commitHash}`, buildDate && `built ${buildDate}`]
			.filter(Boolean)
			.join(' · ') || undefined
	);
	const endpointTooltip = $derived(
		[endpoint, clusterId && `cluster ${clusterId}`].filter(Boolean).join(' · ') || undefined
	);
</script>

<div
	class="border-line rounded-box flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border px-4 py-2.5"
>
	<span class="flex items-center gap-2.5">
		<span class="status {meta.dot}" aria-hidden="true"></span>
		<span class="text-sm {meta.text}">{meta.label}</span>
	</span>

	<div
		class="text-subtle flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs {state ===
		'disconnected'
			? 'opacity-50'
			: ''}"
	>
		<span
			class={[
				'text-muted font-mono',
				versionTooltip &&
					'decoration-base-content/30 cursor-help underline decoration-dotted underline-offset-2'
			]}
			title={versionTooltip}>{version ?? '—'}</span
		>
		<span class="text-subtle">·</span>
		<span class="text-muted font-mono" title={endpointTooltip}>{endpointShort ?? '—'}</span>
		{#if liveNodes !== null}
			<span class="text-subtle">·</span>
			<span class="text-muted">{liveNodes} {liveNodes === 1 ? 'node' : 'nodes'}</span>
			{#if deadNodes !== null && deadNodes > 0}
				<span class="text-error">· {deadNodes} dead</span>
			{/if}
		{/if}
	</div>
</div>
