<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';

	import {
		DATETIME_OUTPUT_FORMATS,
		FAST_PRECISIONS,
		FIELD_TYPES,
		RECORD_OPTIONS,
		TOKENIZERS
	} from 'api/schemas';
	import { emptyFieldRow, type FieldRow, type FieldType } from './index-form';

	let {
		fields = $bindable(),
		timestampField,
		fieldErrors
	}: {
		fields: FieldRow[];
		timestampField: string;
		fieldErrors: Record<string, string>;
	} = $props();

	function addField() {
		fields = [...fields, emptyFieldRow('text')];
	}

	function removeField(i: number) {
		fields = fields.filter((_, idx) => idx !== i);
	}

	function changeType(i: number, type: FieldType) {
		const next = emptyFieldRow(type);
		next.name = fields[i].name;
		fields[i] = next;
	}

	const DATETIME_INPUT_PRESETS = ['rfc3339', 'iso8601', 'rfc2822', 'unix_timestamp'];

	function togglePreset(field: FieldRow, preset: string, checked: boolean) {
		field.inputFormatPresets = checked
			? [...field.inputFormatPresets, preset]
			: field.inputFormatPresets.filter((p) => p !== preset);
	}
</script>

<div class="divide-line flex flex-col divide-y">
	{#each fields as field, i (i)}
		{@const nameError = fieldErrors[`fieldMappings.${i}.name`]}
		<div class="flex flex-col gap-2.5 px-4 py-3">
			<div class="flex items-start gap-2">
				<div class="flex flex-1 flex-col gap-1">
					<input
						type="text"
						bind:value={field.name}
						class="input input-sm w-full font-mono"
						class:input-error={nameError}
						placeholder="field_name"
						autocomplete="off"
						aria-label={`Field ${i + 1} name`}
						aria-invalid={nameError ? 'true' : undefined}
					/>
					{#if nameError}
						<p class="text-error text-xs">{nameError}</p>
					{/if}
				</div>

				<select
					value={field.type}
					onchange={(e) => changeType(i, e.currentTarget.value as FieldType)}
					class="select select-sm w-28"
					aria-label={`Field ${i + 1} type`}
				>
					{#each FIELD_TYPES as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>

				{#if field.type === 'text' || field.type === 'json'}
					<select
						bind:value={field.tokenizer}
						class="select select-sm w-36"
						aria-label={`Field ${i + 1} tokenizer`}
					>
						{#each TOKENIZERS as tok (tok)}
							<option value={tok}>{tok}</option>
						{/each}
					</select>
					<select
						bind:value={field.record}
						class="select select-sm w-28"
						aria-label={`Field ${i + 1} record`}
					>
						{#each RECORD_OPTIONS as r (r)}
							<option value={r}>{r}</option>
						{/each}
					</select>
				{/if}

				<button
					type="button"
					class="text-base-content/50 hover:text-error mt-1 disabled:opacity-30"
					aria-label={`Remove field ${i + 1}`}
					disabled={fields.length === 1}
					onclick={() => removeField(i)}
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 pl-0.5 text-xs">
				<label class="flex items-center gap-1.5">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.indexed} />
					indexed
				</label>
				<label class="flex items-center gap-1.5">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.stored} />
					stored
				</label>
				{#if field.name !== timestampField}
					<label class="flex items-center gap-1.5">
						<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.fast} />
						fast
					</label>
				{/if}
				{#if field.type === 'text'}
					<label class="flex items-center gap-1.5">
						<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.fieldnorms} />
						fieldnorms
					</label>
				{:else if field.type === 'json'}
					<label class="flex items-center gap-1.5">
						<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.expandDots} />
						expand dots
					</label>
				{:else if field.type === 'i64' || field.type === 'u64' || field.type === 'f64'}
					<label class="flex items-center gap-1.5">
						<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.coerce} />
						coerce
					</label>
				{:else if field.type === 'datetime'}
					<label class="flex items-center gap-1.5">
						output
						<select bind:value={field.outputFormat} class="select select-xs w-52">
							{#each DATETIME_OUTPUT_FORMATS as f (f)}
								<option value={f}>{f}</option>
							{/each}
						</select>
					</label>
					<label class="flex items-center gap-1.5">
						precision
						<select bind:value={field.fastPrecision} class="select select-xs w-32">
							{#each FAST_PRECISIONS as p (p)}
								<option value={p}>{p}</option>
							{/each}
						</select>
					</label>
				{/if}
				{#if field.type === 'text' || field.type === 'json'}
					<label class="ml-auto flex items-center gap-1.5">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							bind:checked={field.searchDefault}
						/>
						default search
					</label>
				{/if}
			</div>

			{#if field.type === 'datetime'}
				<div class="flex flex-col gap-2">
					<div class="flex flex-col gap-1">
						<span class="text-base-content/60 text-xs">Input formats</span>
						<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
							{#each DATETIME_INPUT_PRESETS as preset (preset)}
								<label class="flex items-center gap-1.5">
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										checked={field.inputFormatPresets.includes(preset)}
										onchange={(e) => togglePreset(field, preset, e.currentTarget.checked)}
									/>
									{preset}
								</label>
							{/each}
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<span class="text-base-content/60 text-xs">Custom (strptime), one per line</span>
						<textarea
							bind:value={field.inputFormatsCustom}
							rows="2"
							class="textarea textarea-sm w-full max-w-md font-mono"
							placeholder="%Y-%m-%d %H:%M:%S"
							autocomplete="off"
							spellcheck="false"
							aria-label={`Field ${i + 1} custom input formats`}
						></textarea>
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>

<div class="px-4 py-3">
	<button type="button" class="btn btn-ghost btn-sm" onclick={addField}>
		<Plus class="h-3.5 w-3.5" /> Add field
	</button>
</div>
