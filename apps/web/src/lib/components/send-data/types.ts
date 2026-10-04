import type { IconComponent } from '#lib/types.js';
import type { HighlightLang } from '#lib/utils/code-highlight.js';

export type SnippetLang = Exclude<HighlightLang, 'json'>;

export type IntegrationOrigin = 'Application' | 'Agents' | 'Infrastructure';

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
};

export type IntegrationContext = {
	origin: string;
	apiKey: string;
	hasRealApiKey: boolean;
	flavor?: string;
};

export type Signal = 'logs' | 'traces';

/** A tab in a `TabLinks` bar. */
export type TabItem = { id: string; label: string };

export type SignalSetup = {
	flavors?: TabItem[];
	defaultFlavor?: string;
	buildSteps: (ctx: IntegrationContext) => Step[];
};

export type Integration = {
	id: string;
	label: string;
	icon: IconComponent;
	origin: IntegrationOrigin;
	/** Page on docs.rootprint.io for this integration. */
	docs: string;
	logs: SignalSetup;
	/** Absent when the integration cannot emit spans — no Traces tab is rendered for it. */
	traces?: SignalSetup;
};
