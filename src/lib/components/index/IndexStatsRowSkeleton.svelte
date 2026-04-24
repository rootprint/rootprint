<div
	class="grid grid-cols-1 overflow-hidden rounded-t-2xl border border-base-300 md:grid-cols-2 lg:grid-cols-4"
>
	{#each Array.from({ length: 4 }) as _, i (i)}
		<div
			class="flex flex-col gap-2 bg-base-200/40 px-4 py-3 not-last:border-b not-last:border-base-300 lg:not-last:border-r lg:not-last:border-b-0"
		>
			<div class="h-2.5 w-24 skeleton"></div>
			<div class="h-6 w-20 skeleton"></div>
			<div class="h-3 w-32 skeleton"></div>
		</div>
	{/each}
</div>
