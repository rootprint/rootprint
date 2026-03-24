<script lang="ts">
	let {
		timestampField = 'timestamp',
		messageField = 'message',
		extraFields = [],
		columnWidths = {},
		timestampWidth = 0
	}: {
		timestampField?: string;
		messageField?: string;
		extraFields?: string[];
		columnWidths?: Record<string, number>;
		timestampWidth?: number;
	} = $props();
</script>

<div
	class="sticky top-0 z-10 flex items-stretch border-b border-l-4 border-transparent border-b-base-content/10 bg-base-200 pl-3 font-['Roboto_Mono',monospace] text-[13px] font-semibold leading-[22px]"
>
	<span
		class="shrink-0 py-px text-base-content/60"
		style={timestampWidth ? `min-width: ${timestampWidth}ch` : undefined}
	>{timestampField}</span>
	{#each extraFields as field (field)}
		<span
			class="inline-block shrink-0 truncate py-px pl-2 align-top"
			style="width: {columnWidths[field] ?? 'auto'}ch"
		>{field}</span>
	{/each}
	<span class="py-px pl-2">{messageField}</span>
</div>
