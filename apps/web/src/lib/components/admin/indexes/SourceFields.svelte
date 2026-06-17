<script lang="ts">
	import type { SourceFormState } from './source-form';

	let {
		form = $bindable(),
		fieldErrors,
		mode,
		hasExistingToken = false
	}: {
		form: SourceFormState;
		fieldErrors: Record<string, string>;
		mode: 'create' | 'edit';
		hasExistingToken?: boolean;
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
					<option value="kafka">Apache Kafka</option>
					<option value="pulsar">Apache Pulsar</option>
				</select>
			{/if}
		</div>
	</div>

	{#if form.sourceType === 'kinesis'}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-stream" class="text-sm">Stream name</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					{#if mode === 'edit'}
						Immutable once the source is created.
					{:else}
						The Kinesis stream to consume.
					{/if}
				</div>
			</div>
			<div class="flex flex-col gap-1">
				{#if mode === 'edit'}
					<input
						id="src-stream"
						type="text"
						value={form.streamName}
						class="input input-sm w-full"
						readonly
						aria-label="Stream name (read-only)"
					/>
				{:else}
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
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<div class="text-sm">AWS endpoint</div>
				<div class="text-base-content/60 mt-0.5 text-xs">
					{#if mode === 'edit'}
						Immutable once the source is created.
					{:else}
						Provide a region or a custom endpoint — not both. Credentials come from the environment.
					{/if}
				</div>
			</div>
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
		</div>
	{:else if form.sourceType === 'file'}
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
	{:else if form.sourceType === 'kafka'}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-topic" class="text-sm">Topic</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					{#if mode === 'edit'}
						Immutable once the source is created.
					{:else}
						The Kafka topic to consume.
					{/if}
				</div>
			</div>
			<div class="flex flex-col gap-1">
				{#if mode === 'edit'}
					<input
						id="src-topic"
						type="text"
						value={form.topic}
						class="input input-sm w-full"
						readonly
						aria-label="Kafka topic (read-only)"
					/>
				{:else}
					<input
						id="src-topic"
						type="text"
						bind:value={form.topic}
						class="input input-sm w-full"
						class:input-error={fieldErrors.topic}
						placeholder="my-topic"
						autocomplete="off"
						aria-invalid={fieldErrors.topic ? 'true' : undefined}
						aria-describedby={fieldErrors.topic ? 'src-topic-msg' : undefined}
					/>
					{#if fieldErrors.topic}
						<p id="src-topic-msg" class="text-error text-xs">{fieldErrors.topic}</p>
					{/if}
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-client-params" class="text-sm">Client params</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					librdkafka settings as a JSON object (e.g. bootstrap.servers, security.protocol).
					Optional.
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<textarea
					id="src-client-params"
					bind:value={form.clientParamsJson}
					rows="6"
					class="textarea textarea-sm w-full font-mono"
					class:textarea-error={fieldErrors.clientParams}
					placeholder={'{\n  "bootstrap.servers": "localhost:9092"\n}'}
					autocomplete="off"
					spellcheck="false"
					aria-invalid={fieldErrors.clientParams ? 'true' : undefined}
					aria-describedby={fieldErrors.clientParams ? 'src-client-params-msg' : undefined}
				></textarea>
				{#if fieldErrors.clientParams}
					<p id="src-client-params-msg" class="text-error text-xs">{fieldErrors.clientParams}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-log-level" class="text-sm">Client log level</label>
				<div class="text-base-content/60 mt-0.5 text-xs">librdkafka log verbosity. Optional.</div>
			</div>
			<div class="flex flex-col gap-1">
				<select id="src-log-level" bind:value={form.clientLogLevel} class="select select-sm w-full">
					<option value="">Default (info)</option>
					<option value="debug">debug</option>
					<option value="info">info</option>
					<option value="warn">warn</option>
					<option value="error">error</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<div class="text-sm">Backfill mode</div>
				<div class="text-base-content/60 mt-0.5 text-xs">
					Consume from the topic's start, then stop at the current end.
				</div>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="checkbox checkbox-sm"
					bind:checked={form.enableBackfillMode}
				/>
				Enable backfill mode
			</label>
		</div>
	{:else if form.sourceType === 'pulsar'}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-topics" class="text-sm">Topics</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					One topic per line. At least one required.
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<textarea
					id="src-topics"
					bind:value={form.pulsarTopics}
					rows="4"
					class="textarea textarea-sm w-full font-mono"
					class:textarea-error={fieldErrors.topics}
					placeholder="persistent://public/default/my-topic"
					autocomplete="off"
					spellcheck="false"
					aria-invalid={fieldErrors.topics ? 'true' : undefined}
					aria-describedby={fieldErrors.topics ? 'src-topics-msg' : undefined}
				></textarea>
				{#if fieldErrors.topics}
					<p id="src-topics-msg" class="text-error text-xs">{fieldErrors.topics}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-address" class="text-sm">Address</label>
				<div class="text-base-content/60 mt-0.5 text-xs">Pulsar broker URL.</div>
			</div>
			<div class="flex flex-col gap-1">
				<input
					id="src-address"
					type="text"
					bind:value={form.address}
					class="input input-sm w-full"
					class:input-error={fieldErrors.address}
					placeholder="pulsar://localhost:6650"
					autocomplete="off"
					aria-invalid={fieldErrors.address ? 'true' : undefined}
					aria-describedby={fieldErrors.address ? 'src-address-msg' : undefined}
				/>
				{#if fieldErrors.address}
					<p id="src-address-msg" class="text-error text-xs">{fieldErrors.address}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-consumer" class="text-sm">Consumer name</label>
				<div class="text-base-content/60 mt-0.5 text-xs">Defaults to "quickwit". Optional.</div>
			</div>
			<div class="flex flex-col gap-1">
				<input
					id="src-consumer"
					type="text"
					bind:value={form.consumerName}
					class="input input-sm w-full"
					placeholder="quickwit"
					autocomplete="off"
				/>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div>
				<label for="src-auth-method" class="text-sm">Authentication</label>
				<div class="text-base-content/60 mt-0.5 text-xs">
					How Quickwit authenticates to the broker.
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<select
					id="src-auth-method"
					bind:value={form.pulsarAuthType}
					class="select select-sm w-full"
				>
					<option value="none">None</option>
					<option value="token">Token</option>
					<option value="oauth2">OAuth2</option>
				</select>
			</div>
		</div>

		{#if form.pulsarAuthType === 'token'}
			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="src-pulsar-token" class="text-sm">Token</label>
					<div class="text-base-content/60 mt-0.5 text-xs">
						{#if hasExistingToken}
							Leave blank to keep the current token.
						{:else}
							JWT or API key for the broker.
						{/if}
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<input
						id="src-pulsar-token"
						type="password"
						bind:value={form.pulsarToken}
						class="input input-sm w-full"
						class:input-error={fieldErrors.token}
						placeholder={hasExistingToken ? '••••••••' : 'eyJhbGciOi…'}
						autocomplete="off"
						aria-invalid={fieldErrors.token ? 'true' : undefined}
						aria-describedby={fieldErrors.token ? 'src-pulsar-token-msg' : undefined}
					/>
					{#if fieldErrors.token}
						<p id="src-pulsar-token-msg" class="text-error text-xs">{fieldErrors.token}</p>
					{/if}
				</div>
			</div>
		{:else if form.pulsarAuthType === 'oauth2'}
			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="src-oauth-issuer" class="text-sm">Issuer URL</label>
					<div class="text-base-content/60 mt-0.5 text-xs">OAuth2 token issuer URL.</div>
				</div>
				<div class="flex flex-col gap-1">
					<input
						id="src-oauth-issuer"
						type="text"
						bind:value={form.pulsarOauthIssuerUrl}
						class="input input-sm w-full"
						class:input-error={fieldErrors.oauthIssuerUrl}
						placeholder="https://auth.example.com/oauth2"
						autocomplete="off"
						aria-invalid={fieldErrors.oauthIssuerUrl ? 'true' : undefined}
						aria-describedby={fieldErrors.oauthIssuerUrl ? 'src-oauth-issuer-msg' : undefined}
					/>
					{#if fieldErrors.oauthIssuerUrl}
						<p id="src-oauth-issuer-msg" class="text-error text-xs">
							{fieldErrors.oauthIssuerUrl}
						</p>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="src-oauth-creds" class="text-sm">Credentials URL</label>
					<div class="text-base-content/60 mt-0.5 text-xs">
						URL or file path to the service-account credentials.
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<input
						id="src-oauth-creds"
						type="text"
						bind:value={form.pulsarOauthCredentialsUrl}
						class="input input-sm w-full"
						class:input-error={fieldErrors.oauthCredentialsUrl}
						placeholder="file:///etc/pulsar/credentials.json"
						autocomplete="off"
						aria-invalid={fieldErrors.oauthCredentialsUrl ? 'true' : undefined}
						aria-describedby={fieldErrors.oauthCredentialsUrl ? 'src-oauth-creds-msg' : undefined}
					/>
					{#if fieldErrors.oauthCredentialsUrl}
						<p id="src-oauth-creds-msg" class="text-error text-xs">
							{fieldErrors.oauthCredentialsUrl}
						</p>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="src-oauth-audience" class="text-sm">Audience</label>
					<div class="text-base-content/60 mt-0.5 text-xs">Optional.</div>
				</div>
				<div class="flex flex-col gap-1">
					<input
						id="src-oauth-audience"
						type="text"
						bind:value={form.pulsarOauthAudience}
						class="input input-sm w-full"
						placeholder="urn:my-cluster"
						autocomplete="off"
					/>
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="src-oauth-scope" class="text-sm">Scope</label>
					<div class="text-base-content/60 mt-0.5 text-xs">Optional.</div>
				</div>
				<div class="flex flex-col gap-1">
					<input
						id="src-oauth-scope"
						type="text"
						bind:value={form.pulsarOauthScope}
						class="input input-sm w-full"
						placeholder="api://pulsar/.default"
						autocomplete="off"
					/>
				</div>
			</div>
		{/if}
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
