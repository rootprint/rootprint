<script lang="ts">
	import { getNestedValue, formatFieldValue } from '$lib/utils/format';
	import JsonHighlight from '$lib/components/JsonHighlight.svelte';

	let {
		hit,
		wrapMode,
		levelField = 'level',
		timestampField = 'timestamp',
		messageField = 'message',
		extraFields = [],
		columnWidths = {},
		timezoneMode = 'local' as 'utc' | 'local',
		onclick = () => {}
	}: {
		hit: Record<string, unknown>;
		wrapMode: 'none' | 'wrap' | 'pretty';
		levelField?: string;
		timestampField?: string;
		messageField?: string;
		extraFields?: string[];
		columnWidths?: Record<string, number>;
		timezoneMode?: 'utc' | 'local';
		onclick?: () => void;
	} = $props();

	function extractSeverity(doc: Record<string, unknown>): string {
		const raw = (doc[levelField] ?? 'unknown') as string;
		return raw.toString().toLowerCase();
	}

	function severityBorderColor(severity: string): string {
		switch (severity) {
			case 'error':
			case 'fatal':
			case 'critical':
				return 'border-l-error';
			case 'warn':
			case 'warning':
				return 'border-l-warning';
			case 'debug':
			case 'trace':
				return 'border-l-accent';
			case 'info':
				return 'border-l-info';
			default:
				return 'border-l-base-content/30';
		}
	}

	function severityLabel(severity: string): string {
		return severity.toUpperCase();
	}

	function extractTimestamp(doc: Record<string, unknown>): string {
		const raw = doc[timestampField];
		if (!raw) return '';
		const value = typeof raw === 'number' && raw < 10_000_000_000 ? raw * 1000 : raw;
		const date = new Date(value as string | number);
		if (isNaN(date.getTime())) return String(raw);

		if (timezoneMode === 'utc') {
			const y = date.getUTCFullYear();
			const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
			const d = String(date.getUTCDate()).padStart(2, '0');
			const h = String(date.getUTCHours()).padStart(2, '0');
			const mi = String(date.getUTCMinutes()).padStart(2, '0');
			const s = String(date.getUTCSeconds()).padStart(2, '0');
			const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
			return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
		}
		const y = date.getFullYear();
		const mo = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		const h = String(date.getHours()).padStart(2, '0');
		const mi = String(date.getMinutes()).padStart(2, '0');
		const s = String(date.getSeconds()).padStart(2, '0');
		const ms = String(date.getMilliseconds()).padStart(3, '0');
		return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
	}

	function extractMessage(doc: Record<string, unknown>): string {
		// Try direct nested access first (handles dot notation like "body.text")
		const nested = getNestedValue(doc, messageField);
		if (nested !== undefined && nested !== null) return String(nested);

		// If dot-path access failed, try parsing JSON strings along the path
		// This handles cases like message.text where message is '{"text":"..."}'
		if (messageField.includes('.')) {
			const parts = messageField.split('.');
			let current: unknown = doc;
			for (const part of parts) {
				if (current === null || current === undefined) break;
				if (typeof current === 'string') {
					try {
						current = JSON.parse(current);
					} catch {
						break;
					}
				}
				if (typeof current === 'object') {
					current = (current as Record<string, unknown>)[part];
				} else {
					current = undefined;
					break;
				}
			}
			if (current !== undefined && current !== null) return String(current);
		}

		return JSON.stringify(doc);
	}

	function formatContent(doc: Record<string, unknown>, mode: 'none' | 'wrap' | 'pretty'): string {
		const message = extractMessage(doc);
		if (mode === 'pretty') {
			try {
				return JSON.stringify(JSON.parse(message), null, 2);
			} catch {
				return message;
			}
		}
		return message;
	}

	function isError(sev: string): boolean {
		return sev === 'error' || sev === 'fatal' || sev === 'critical';
	}

	const severity = $derived(extractSeverity(hit));

	const prettyJson = $derived.by(() => {
		if (wrapMode !== 'pretty') return null;
		const message = extractMessage(hit);
		try {
			return JSON.stringify(JSON.parse(message), null, 2);
		} catch {
			return null;
		}
	});
</script>

<div
	class="cursor-pointer border-b border-l-4 border-base-content/5 pl-3 font-['Roboto_Mono',monospace] text-[13px] leading-[22px] hover:bg-base-content/[0.07] {severityBorderColor(
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
	<span class="shrink-0 py-px text-base-content/40">{extractTimestamp(hit)}</span>
	{#each extraFields as field (field)}
		<span
			class="inline-block shrink-0 truncate py-px pl-2 align-top"
			style="width: {columnWidths[field] ?? 'auto'}ch"
			>{formatFieldValue(getNestedValue(hit, field))}</span
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
				: 'whitespace-nowrap'}">{formatContent(hit, wrapMode)}</span
		>
	{/if}
</div>
