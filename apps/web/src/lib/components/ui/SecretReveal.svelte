<script lang="ts">
	import { KeyRound } from 'lucide-svelte';
	import CopyButton from './CopyButton.svelte';

	let { value, label }: { value: string; label: string } = $props();
</script>

<div class="border-line rounded-box overflow-hidden border">
	<div class="border-line bg-base-200 flex items-center justify-between gap-3 border-b px-3 py-1.5">
		<div class="text-muted flex items-center gap-2 text-sm">
			<KeyRound class="size-3.5 shrink-0" aria-hidden="true" />
			<span>{label}</span>
		</div>
		<CopyButton text={value} aria-label="Copy {label.toLowerCase()}">Copy</CopyButton>
	</div>
	<div class="bg-base-100 px-4 py-3 font-mono text-xs leading-relaxed break-all select-all">
		{value}
	</div>
</div>
