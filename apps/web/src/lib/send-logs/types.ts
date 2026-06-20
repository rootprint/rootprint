import type { Component, ComponentType } from 'svelte';

// `@iconify-svelte/logos` and `lucide-svelte` export legacy class components,
// while Svelte 5's `Component` is the function-component type. Accept either.
export type IconComponent = Component<Record<string, unknown>> | ComponentType;

export type SnippetLang = 'bash' | 'python' | 'javascript' | 'go' | 'yaml' | 'ini';

export type IntegrationOrigin =
	| 'OpenTelemetry'
	| 'LogAgents'
	| 'WebServers'
	| 'Containers'
	| 'Application'
	| 'Cloud';

export type Snippet = {
	code: string;
	lang: SnippetLang;
	copyTitle?: string;
	highlightValue?: string;
};

export type Callout = {
	variant: 'info' | 'warning';
	html: string;
};

export type Verify = {
	label: string;
	href: string;
};

export type LinkOut = {
	label: string;
	href: string;
};

export type Step = {
	title: string;
	body?: string;
	linkOut?: LinkOut;
	snippets?: Snippet[];
	callout?: Callout;
	verify?: Verify;
};

export type IntegrationContext = {
	origin: string;
	apiKey: string;
	hasRealApiKey: boolean;
	indexId: string;
	flavor?: string;
};

export type Flavor = { id: string; label: string };

export type Integration = {
	id: string;
	label: string;
	icon: IconComponent;
	origin: IntegrationOrigin;
	flavors?: Flavor[];
	defaultFlavor?: string;
	buildSteps: (ctx: IntegrationContext) => Step[];
};
