<script lang="ts" generics="TSchema extends v.GenericSchema">
	import type { Snippet } from 'svelte';
	import * as v from 'valibot';

	import { issuesToFieldErrors, toFormErrors } from '$lib/api/errors';
	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title,
		submitLabel,
		busyLabel = 'Creating…',
		// a fieldless modal (confirm + reveal) validates nothing, so the cast has no output to widen
		schema = v.object({}) as unknown as TSchema,
		values = () => ({}),
		submit,
		onclose,
		fields,
		reveal
	}: {
		open?: boolean;
		title: string;
		submitLabel: string;
		busyLabel?: string;
		schema?: TSchema;
		values?: () => unknown;
		submit: (input: v.InferOutput<TSchema>) => Promise<void>;
		onclose?: () => void;
		fields: Snippet<[Record<string, string>]>;
		/** Passing this snippet is what gives the modal a second phase. */
		reveal?: Snippet;
	} = $props();

	const uid = $props.id();
	const formId = `form-${uid}`;

	// stable reference on purpose: an inline arrow would be a new attachment on every
	// re-render, stealing focus back from whatever the user moved to
	const focusOnCreate = (node: HTMLElement) => node.focus();

	let done = $state(false);
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function handleClose() {
		done = false;
		submitting = false;
		formError = null;
		fieldErrors = {};
		onclose?.();
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(schema, values());
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			await submit(parsed.output);
			if (!reveal) {
				open = false;
				return;
			}
			done = true;
			open = true; // re-open if dismissed mid-request — a one-time secret must be shown
		} catch (err) {
			const formErrors = toFormErrors(err, 'Something went wrong');
			formError = formErrors.message;
			fieldErrors = formErrors.fieldErrors;
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	{title}
	onclose={handleClose}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	{#if done && reveal}
		<!-- the phase swap destroys the focused submit button; move focus onto the revealed
		     content so assistive tech announces it rather than dropping to <body> -->
		<div tabindex="-1" class="focus:outline-none" {@attach focusOnCreate}>
			{@render reveal()}
		</div>
	{:else}
		<form id={formId} class="flex flex-col gap-3" {onsubmit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}
			{@render fields(fieldErrors)}
		</form>
	{/if}

	{#snippet actions()}
		{#if done && reveal}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{:else}
			<button
				type="button"
				class="btn btn-ghost"
				disabled={submitting}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button form={formId} type="submit" class="btn btn-primary" disabled={submitting}>
				{submitting ? busyLabel : submitLabel}
			</button>
		{/if}
	{/snippet}
</Modal>
