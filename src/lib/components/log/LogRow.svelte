<script lang="ts">
	import JsonHighlight from '$lib/components/ui/JsonHighlight.svelte';
	import type { TimezoneMode, WrapMode } from '$lib/types';
	import { TIMESTAMP_COLUMN_WIDTH } from '$lib/utils/column-width';
	import { formatFieldValue, resolveFieldValue } from '$lib/utils/field-resolver';
	import { extractSeverity, extractTimestamp, severityBorderColor } from '$lib/utils/log-helpers';

	let {
		hit,
		wrapMode,
		levelField,
		timestampField,
		messageField,
		extraFields = [],
		columnWidths = {},
		timezoneMode = 'local' as TimezoneMode,
		onclick = () => {}
	}: {
		hit: Record<string, unknown>;
		wrapMode: WrapMode;
		levelField: string;
		timestampField: string;
		messageField: string;
		extraFields?: string[];
		columnWidths?: Record<string, number>;
		timezoneMode?: TimezoneMode;
		onclick?: () => void;
	} = $props();

	function extractMessage(doc: Record<string, unknown>): string {
		const raw = resolveFieldValue(doc, messageField);
		return raw != null ? formatFieldValue(raw) : JSON.stringify(doc);
	}

	const severity = $derived(extractSeverity(hit, levelField));

	const prettyJson = $derived.by(() => {
		if (wrapMode !== 'wrap') return null;
		const message = extractMessage(hit);
		try {
			return JSON.stringify(JSON.parse(message), null, 2);
		} catch {
			return null;
		}
	});
</script>

<div
	class="cursor-pointer border-b border-l-4 border-base-content/5 pl-3 font-['Roboto_Mono',monospace] text-[13px] leading-5.5 hover:bg-base-content/[0.07] {severityBorderColor(
		severity
	)} {wrapMode === 'none' ? 'flex items-stretch' : ''}"
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick();
		}
	}}
>
	<span class="shrink-0 py-px text-base-content/60" style="min-width: {TIMESTAMP_COLUMN_WIDTH}ch"
		>{extractTimestamp(hit, timestampField, timezoneMode)}</span
	><span class="shrink-0 px-1.5 text-base-content/20">|</span>
	{#each extraFields as field (field)}
		<span
			class="inline-block shrink-0 truncate py-px pl-2 align-top"
			style="width: {columnWidths[field] ?? 'auto'}ch"
			>{formatFieldValue(resolveFieldValue(hit, field))}</span
		>
	{/each}
	{#if prettyJson}
		<span class="py-px pl-2 break-all whitespace-pre-wrap text-base-content/80">
			<JsonHighlight code={prettyJson} />
		</span>
	{:else}
		<span
			class="py-px pl-2 text-base-content/80 {wrapMode !== 'none'
				? 'break-all whitespace-pre-wrap'
				: 'whitespace-nowrap'}">{extractMessage(hit)}</span
		>
	{/if}
</div>
