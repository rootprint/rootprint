<script lang="ts">
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
	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="src-id" class="text-sm">Source ID</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				{#if mode === 'edit'}
					Immutable once the source is created.
				{:else}
					Starts with a letter; 3–255 chars (letters, digits, - or _).
				{/if}
			</div>
		</div>
		<div class="flex flex-col gap-1">
			{#if mode === 'edit'}
				<input
					id="src-id"
					type="text"
					value={form.sourceId}
					class="input input-sm w-full"
					readonly
					aria-label="Source ID (read-only)"
				/>
			{:else}
				<input
					id="src-id"
					type="text"
					bind:value={form.sourceId}
					class="input input-sm w-full"
					class:input-error={fieldErrors.sourceId}
					placeholder="e.g. my-kinesis-source"
					autocomplete="off"
					aria-invalid={fieldErrors.sourceId ? 'true' : undefined}
					aria-describedby={fieldErrors.sourceId ? 'src-id-msg' : undefined}
				/>
				{#if fieldErrors.sourceId}
					<p id="src-id-msg" class="text-error text-xs">{fieldErrors.sourceId}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="src-type" class="text-sm">Source type</label>
			<div class="text-base-content/60 mt-0.5 text-xs">Where Quickwit reads documents from.</div>
		</div>
		<div class="flex flex-col gap-1">
			{#if mode === 'edit'}
				<input
					id="src-type"
					type="text"
					value={form.sourceType}
					class="input input-sm w-full"
					readonly
					aria-label="Source type (read-only)"
				/>
			{:else}
				<select id="src-type" bind:value={form.sourceType} class="select select-sm w-full">
					<option value="kinesis">Amazon Kinesis</option>
					<option value="file">File (S3 / SQS notifications)</option>
				</select>
			{/if}
		</div>
	</div>

	{#if form.sourceType === 'kinesis'}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-stream" class="text-sm">Stream name</label>
				<div class="text-base-content/60 mt-0.5 text-xs">The Kinesis stream to consume.</div>
			</div>
			<div class="flex flex-col gap-1">
				<input
					id="src-stream"
					type="text"
					bind:value={form.streamName}
					class="input input-sm w-full"
					class:input-error={fieldErrors.streamName}
					placeholder="my-stream"
					autocomplete="off"
					aria-invalid={fieldErrors.streamName ? 'true' : undefined}
					aria-describedby={fieldErrors.streamName ? 'src-stream-msg' : undefined}
				/>
				{#if fieldErrors.streamName}
					<p id="src-stream-msg" class="text-error text-xs">{fieldErrors.streamName}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<div class="text-sm">AWS endpoint</div>
				<div class="text-base-content/60 mt-0.5 text-xs">
					Provide a region or a custom endpoint — not both. Credentials come from the environment.
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex gap-4 text-sm">
					<label class="flex items-center gap-2">
						<input type="radio" class="radio radio-sm" value="region" bind:group={form.awsTarget} />
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
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-queue" class="text-sm">SQS queue URL</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					The SQS queue that receives the bucket notifications.
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<input
					id="src-queue"
					type="text"
					bind:value={form.queueUrl}
					class="input input-sm w-full"
					class:input-error={fieldErrors.queueUrl}
					placeholder="https://sqs.us-east-1.amazonaws.com/123456789/my-queue"
					autocomplete="off"
					aria-invalid={fieldErrors.queueUrl ? 'true' : undefined}
					aria-describedby={fieldErrors.queueUrl ? 'src-queue-msg' : undefined}
				/>
				{#if fieldErrors.queueUrl}
					<p id="src-queue-msg" class="text-error text-xs">{fieldErrors.queueUrl}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-message-type" class="text-sm">Message type</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					How the SQS message references the file.
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<select id="src-message-type" bind:value={form.messageType} class="select select-sm w-full">
					<option value="s3_notification">S3 notification</option>
					<option value="raw_uri">Raw URI</option>
				</select>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="src-input-format" class="text-sm">Input format</label>
			<div class="text-base-content/60 mt-0.5 text-xs">Document format on the wire. Optional.</div>
		</div>
		<div class="flex flex-col gap-1">
			<select id="src-input-format" bind:value={form.inputFormat} class="select select-sm w-full">
				<option value="">Default (JSON)</option>
				<option value="json">json</option>
				<option value="plain_text">plain_text</option>
				<option value="otlp_logs_json">otlp_logs_json</option>
				<option value="otlp_logs_protobuf">otlp_logs_protobuf</option>
				<option value="otlp_traces_json">otlp_traces_json</option>
				<option value="otlp_traces_protobuf">otlp_traces_protobuf</option>
			</select>
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="src-pipelines" class="text-sm">Number of pipelines</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Indexing pipelines for this source. Optional.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="src-pipelines"
				type="text"
				inputmode="numeric"
				bind:value={form.numPipelines}
				class="input input-sm w-full"
				class:input-error={fieldErrors.numPipelines}
				placeholder="1"
				autocomplete="off"
				aria-invalid={fieldErrors.numPipelines ? 'true' : undefined}
				aria-describedby={fieldErrors.numPipelines ? 'src-pipelines-msg' : undefined}
			/>
			{#if fieldErrors.numPipelines}
				<p id="src-pipelines-msg" class="text-error text-xs">{fieldErrors.numPipelines}</p>
			{/if}
		</div>
	</div>
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
			aria-describedby={fieldErrors.vrlScript ? 'src-vrl-msg' : undefined}
		></textarea>
		{#if fieldErrors.vrlScript}
			<p id="src-vrl-msg" class="text-error text-xs">{fieldErrors.vrlScript}</p>
		{/if}
	</div>
</div>
