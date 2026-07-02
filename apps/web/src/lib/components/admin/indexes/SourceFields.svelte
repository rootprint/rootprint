<script lang="ts">
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import type { SourceFormState } from './source-form';

	let {
		form = $bindable(),
		fieldErrors,
		mode
	}: {
		form: SourceFormState;
		fieldErrors: Record<string, string>;
		mode: 'create' | 'edit';
	} = $props();

	type Tab = 'connection' | 'transform';
	let activeTab = $state<Tab>('connection');

	const transformHasError = $derived(Boolean(fieldErrors.vrlScript));
	const connectionHasError = $derived(Object.keys(fieldErrors).some((key) => key !== 'vrlScript'));

	$effect(() => {
		if (connectionHasError) activeTab = 'connection';
		else if (transformHasError) activeTab = 'transform';
	});
</script>

<div role="tablist" aria-label="Source configuration sections" class="flex gap-1 px-4 pt-3">
	<button
		type="button"
		role="tab"
		id="src-tab-connection"
		aria-controls="src-panel-connection"
		aria-selected={activeTab === 'connection'}
		onclick={() => (activeTab = 'connection')}
		class={[
			'relative flex h-9 items-center gap-1.5 px-3 text-xs transition-colors',
			activeTab === 'connection'
				? 'text-base-content'
				: 'text-base-content/60 hover:text-base-content'
		]}
	>
		Connection
		{#if connectionHasError}
			<span class="bg-error h-1.5 w-1.5 rounded-full" aria-hidden="true"></span>
		{/if}
		{#if activeTab === 'connection'}
			<span class="bg-base-content absolute right-0 -bottom-px left-0 h-0.5"></span>
		{/if}
	</button>
	<button
		type="button"
		role="tab"
		id="src-tab-transform"
		aria-controls="src-panel-transform"
		aria-selected={activeTab === 'transform'}
		onclick={() => (activeTab = 'transform')}
		class={[
			'relative flex h-9 items-center gap-1.5 px-3 text-xs transition-colors',
			activeTab === 'transform'
				? 'text-base-content'
				: 'text-base-content/60 hover:text-base-content'
		]}
	>
		Transform (VRL)
		{#if transformHasError}
			<span class="bg-error h-1.5 w-1.5 rounded-full" aria-hidden="true"></span>
		{/if}
		{#if activeTab === 'transform'}
			<span class="bg-base-content absolute right-0 -bottom-px left-0 h-0.5"></span>
		{/if}
	</button>
</div>

<div
	role="tabpanel"
	id="src-panel-connection"
	aria-labelledby="src-tab-connection"
	class="divide-line flex flex-col divide-y"
	class:hidden={activeTab !== 'connection'}
>
	<SettingsRow
		id="src-id"
		label="Source ID"
		hint={mode === 'edit'
			? 'Immutable once the source is created.'
			: 'Starts with a letter; 3–255 chars (letters, digits, - or _).'}
		error={fieldErrors.sourceId}
	>
		{#snippet children({ id, invalid, describedBy })}
			{#if mode === 'edit'}
				<input
					{id}
					type="text"
					value={form.sourceId}
					class="input input-sm w-full"
					readonly
					aria-label="Source ID (read-only)"
				/>
			{:else}
				<input
					{id}
					type="text"
					bind:value={form.sourceId}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="e.g. my-kinesis-source"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/if}
		{/snippet}
	</SettingsRow>

	<SettingsRow id="src-type" label="Source type" hint="Where Quickwit reads documents from.">
		{#snippet children({ id })}
			{#if mode === 'edit'}
				<input
					{id}
					type="text"
					value={form.sourceType}
					class="input input-sm w-full"
					readonly
					aria-label="Source type (read-only)"
				/>
			{:else}
				<select {id} bind:value={form.sourceType} class="select select-sm w-full">
					<option value="kinesis">Amazon Kinesis</option>
					<option value="file">Amazon SQS (S3 notifications)</option>
					<option value="kafka">Apache Kafka</option>
				</select>
			{/if}
		{/snippet}
	</SettingsRow>

	{#if form.sourceType === 'kinesis'}
		<SettingsRow
			id="src-stream"
			label="Stream name"
			hint={mode === 'edit'
				? 'Immutable once the source is created.'
				: 'The Kinesis stream to consume.'}
			error={fieldErrors.streamName}
		>
			{#snippet children({ id, invalid, describedBy })}
				{#if mode === 'edit'}
					<input
						{id}
						type="text"
						value={form.streamName}
						class="input input-sm w-full"
						readonly
						aria-label="Stream name (read-only)"
					/>
				{:else}
					<input
						{id}
						type="text"
						bind:value={form.streamName}
						class="input input-sm w-full"
						class:input-error={invalid}
						placeholder="my-stream"
						autocomplete="off"
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
					/>
				{/if}
			{/snippet}
		</SettingsRow>

		<SettingsRow
			plain
			label="AWS endpoint"
			hint={mode === 'edit'
				? 'Immutable once the source is created.'
				: 'Provide a region or a custom endpoint — not both. Credentials come from the environment.'}
		>
			<div class="flex flex-col gap-2">
				{#if mode === 'edit'}
					<input
						id="src-aws-endpoint"
						type="text"
						value={form.awsTarget === 'endpoint' ? form.endpoint : form.region}
						class="input input-sm w-full"
						readonly
						aria-label={form.awsTarget === 'endpoint'
							? 'Custom endpoint (read-only)'
							: 'AWS region (read-only)'}
					/>
				{:else}
					<div class="flex gap-4 text-sm">
						<label class="flex items-center gap-2">
							<input
								type="radio"
								class="radio radio-sm"
								value="region"
								bind:group={form.awsTarget}
							/>
							Region
						</label>
						<label class="flex items-center gap-2">
							<input
								type="radio"
								class="radio radio-sm"
								value="endpoint"
								bind:group={form.awsTarget}
							/>
							Custom endpoint
						</label>
					</div>
					{#if form.awsTarget === 'region'}
						<input
							id="src-region"
							type="text"
							bind:value={form.region}
							class="input input-sm w-full"
							class:input-error={fieldErrors.region}
							placeholder="us-east-1"
							autocomplete="off"
							aria-label="AWS region"
							aria-invalid={fieldErrors.region ? 'true' : undefined}
							aria-describedby={fieldErrors.region ? 'src-region-msg' : undefined}
						/>
						{#if fieldErrors.region}
							<p id="src-region-msg" class="text-error text-xs">{fieldErrors.region}</p>
						{/if}
					{:else}
						<input
							id="src-endpoint"
							type="text"
							bind:value={form.endpoint}
							class="input input-sm w-full"
							class:input-error={fieldErrors.endpoint}
							placeholder="http://localhost:4566"
							autocomplete="off"
							aria-label="Custom endpoint"
							aria-invalid={fieldErrors.endpoint ? 'true' : undefined}
							aria-describedby={fieldErrors.endpoint ? 'src-endpoint-msg' : undefined}
						/>
						{#if fieldErrors.endpoint}
							<p id="src-endpoint-msg" class="text-error text-xs">{fieldErrors.endpoint}</p>
						{/if}
					{/if}
				{/if}
			</div>
		</SettingsRow>
	{:else if form.sourceType === 'file'}
		<SettingsRow
			id="src-queue"
			label="SQS queue URL"
			hint="The SQS queue that receives the bucket notifications."
			error={fieldErrors.queueUrl}
		>
			{#snippet children({ id, invalid, describedBy })}
				<input
					{id}
					type="text"
					bind:value={form.queueUrl}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="https://sqs.us-east-1.amazonaws.com/123456789/my-queue"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="src-message-type"
			label="Message type"
			hint="How the SQS message references the file."
		>
			{#snippet children({ id })}
				<select {id} bind:value={form.messageType} class="select select-sm w-full">
					<option value="s3_notification">S3 notification</option>
					<option value="raw_uri">Raw URI</option>
				</select>
			{/snippet}
		</SettingsRow>
	{:else if form.sourceType === 'kafka'}
		<SettingsRow
			id="src-topic"
			label="Topic"
			hint={mode === 'edit'
				? 'Immutable once the source is created.'
				: 'The Kafka topic to consume.'}
			error={fieldErrors.topic}
		>
			{#snippet children({ id, invalid, describedBy })}
				{#if mode === 'edit'}
					<input
						{id}
						type="text"
						value={form.topic}
						class="input input-sm w-full"
						readonly
						aria-label="Kafka topic (read-only)"
					/>
				{:else}
					<input
						{id}
						type="text"
						bind:value={form.topic}
						class="input input-sm w-full"
						class:input-error={invalid}
						placeholder="my-topic"
						autocomplete="off"
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
					/>
				{/if}
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="src-client-params"
			label="Client params"
			hint="librdkafka settings as a JSON object (e.g. bootstrap.servers, security.protocol). Optional."
			error={fieldErrors.clientParams}
		>
			{#snippet children({ id, invalid, describedBy })}
				<textarea
					{id}
					bind:value={form.clientParamsJson}
					rows="6"
					class="textarea textarea-sm w-full font-mono"
					class:textarea-error={invalid}
					placeholder={'{\n  "bootstrap.servers": "localhost:9092"\n}'}
					autocomplete="off"
					spellcheck="false"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}></textarea>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="src-log-level"
			label="Client log level"
			hint="librdkafka log verbosity. Optional."
		>
			{#snippet children({ id })}
				<select {id} bind:value={form.clientLogLevel} class="select select-sm w-full">
					<option value="">Default (info)</option>
					<option value="debug">debug</option>
					<option value="info">info</option>
					<option value="warn">warn</option>
					<option value="error">error</option>
				</select>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			plain
			label="Backfill mode"
			hint="Consume from the topic's start, then stop at the current end."
		>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="checkbox checkbox-sm"
					bind:checked={form.enableBackfillMode}
				/>
				Enable backfill mode
			</label>
		</SettingsRow>
	{/if}

	<SettingsRow
		id="src-input-format"
		label="Input format"
		hint="Document format on the wire. Optional."
	>
		{#snippet children({ id })}
			<select {id} bind:value={form.inputFormat} class="select select-sm w-full">
				<option value="">Default (JSON)</option>
				<option value="json">json</option>
				<option value="plain_text">plain_text</option>
				<option value="otlp_logs_json">otlp_logs_json</option>
				<option value="otlp_logs_protobuf">otlp_logs_protobuf</option>
				<option value="otlp_traces_json">otlp_traces_json</option>
				<option value="otlp_traces_protobuf">otlp_traces_protobuf</option>
			</select>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		id="src-pipelines"
		label="Number of pipelines"
		hint="Indexing pipelines for this source. Optional."
		error={fieldErrors.numPipelines}
	>
		{#snippet children({ id, invalid, describedBy })}
			<input
				{id}
				type="text"
				inputmode="numeric"
				bind:value={form.numPipelines}
				class="input input-sm w-full"
				class:input-error={invalid}
				placeholder="1"
				autocomplete="off"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
		{/snippet}
	</SettingsRow>
</div>

<div
	role="tabpanel"
	id="src-panel-transform"
	aria-labelledby="src-tab-transform"
	class="flex flex-col"
	class:hidden={activeTab !== 'transform'}
>
	<div class="flex flex-col gap-3 px-4 py-4">
		<div>
			<label for="src-vrl" class="text-sm">VRL script</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Optional Vector Remap Language program run on each document before indexing. Leave blank to
				disable.
			</div>
		</div>
		<textarea
			id="src-vrl"
			bind:value={form.vrlScript}
			rows="14"
			class="textarea textarea-sm w-full font-mono"
			class:textarea-error={fieldErrors.vrlScript}
			placeholder={'.message = downcase(string!(.message))\ndel(.username)'}
			autocomplete="off"
			spellcheck="false"
			aria-invalid={fieldErrors.vrlScript ? 'true' : undefined}
			aria-describedby={fieldErrors.vrlScript ? 'src-vrl-msg' : undefined}></textarea>
		{#if fieldErrors.vrlScript}
			<p id="src-vrl-msg" class="text-error text-xs">{fieldErrors.vrlScript}</p>
		{/if}
	</div>
</div>
