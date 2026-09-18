import * as v from 'valibot';
import {
	githubAllowedOrgsSchema,
	googleAllowedDomainsSchema,
	oauthCredentialsSchema,
	oidcCredentialsSchema
} from 'api/schemas';

import {
	removeGitHubCredentials,
	removeGoogleCredentials,
	removeOidcCredentials,
	saveGitHubAllowedOrgs,
	saveGitHubCredentials,
	saveGoogleAllowedDomains,
	saveGoogleCredentials,
	saveOidcCredentials
} from '$lib/api/auth-config';
import { issuesToFieldErrors } from '$lib/api/errors';
import type { ExternalProviderId } from 'api/types';

/** `issuerUrl` is empty for providers without an issuer row; their schemas strip it. */
export type CredentialInput = { issuerUrl: string; clientId: string; clientSecret: string };

export type OAuthProviderDescriptor = {
	id: ExternalProviderId;
	name: string;
	pageDescription: string;
	/** Help line under "Callback URL". */
	callbackDescription: string;
	clientIdPlaceholder: string;
	/** Unconfigured-state hint under "Client ID". */
	clientIdHint: string;
	/** Unconfigured-state hint under "Client Secret". */
	clientSecretHint: string;
	successToast: string;
	issuer?: { hint: string; placeholder: string };
	/** Returns `fieldErrors` on schema failure, null when valid. */
	validateCredentials: (input: CredentialInput) => Record<string, string> | null;
	saveCredentials: (input: CredentialInput) => Promise<void>;
	removeCredentials: () => Promise<void>;
	items?: {
		/** `fieldErrors` key for the tag list. */
		fieldKey: 'allowedOrgs' | 'allowedDomains';
		label: string;
		description: string;
		placeholderEmpty: string;
		addLabel: string;
		normalize?: (raw: string) => string;
		/** Per-item add-time validation; returns an error message or null. */
		validate: (value: string) => string | null;
		duplicateMessage: string;
		/** Submit-time schema validation; returns `fieldErrors` on failure, null when valid. */
		validateItems: (items: string[]) => Record<string, string> | null;
		saveItems: (items: string[]) => Promise<void>;
		saveFailedFallback: string;
	};
};

function schemaErrors<TSchema extends v.GenericSchema>(
	schema: TSchema,
	value: v.InferInput<TSchema>
): Record<string, string> | null {
	const parsed = v.safeParse(schema, value);
	return parsed.success ? null : issuesToFieldErrors(parsed.issues);
}

// GitHub org login: 1–39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const orgPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export const githubProvider: OAuthProviderDescriptor = {
	id: 'github',
	name: 'GitHub',
	pageDescription: 'Configure GitHub OAuth so members of approved organizations can sign in.',
	callbackDescription: 'Add this as the Authorization callback URL in your GitHub OAuth App.',
	clientIdPlaceholder: 'Iv1.0123456789abcdef',
	clientIdHint: 'From your GitHub OAuth App.',
	clientSecretHint: 'Server-side secret from your GitHub OAuth App.',
	successToast: 'GitHub authentication settings saved',
	validateCredentials: (input) => schemaErrors(oauthCredentialsSchema, input),
	saveCredentials: saveGitHubCredentials,
	removeCredentials: removeGitHubCredentials,
	items: {
		fieldKey: 'allowedOrgs',
		label: 'Allowed organizations',
		description:
			'Only members of these GitHub organizations can sign in. Changes apply at the next sign-in.',
		placeholderEmpty: 'my-org  (press Enter to add)',
		addLabel: 'Add organization',
		normalize: (raw) => raw.toLowerCase(),
		validate: (value) => (orgPattern.test(value) ? null : 'Invalid organization name'),
		duplicateMessage: 'Organization already added',
		validateItems: (items) => schemaErrors(githubAllowedOrgsSchema, { allowedOrgs: items }),
		saveItems: (items) => saveGitHubAllowedOrgs({ allowedOrgs: items }),
		saveFailedFallback: 'Failed to save allowed organizations'
	}
};

const domainPattern = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export const googleProvider: OAuthProviderDescriptor = {
	id: 'google',
	name: 'Google',
	pageDescription: 'Configure Google OAuth so users from approved domains can sign in.',
	callbackDescription: 'Add this as an authorized redirect URI in Google Cloud Console.',
	clientIdPlaceholder: '12345.apps.googleusercontent.com',
	clientIdHint: 'From Google Cloud Console.',
	clientSecretHint: 'Server-side secret from Google Cloud Console.',
	successToast: 'Google authentication settings saved',
	validateCredentials: (input) => schemaErrors(oauthCredentialsSchema, input),
	saveCredentials: saveGoogleCredentials,
	removeCredentials: removeGoogleCredentials,
	items: {
		fieldKey: 'allowedDomains',
		label: 'Allowed domains',
		description:
			'Only users with an email from these domains can sign in. Changes apply at the next sign-in.',
		placeholderEmpty: 'company.com  (press Enter to add)',
		addLabel: 'Add domain',
		normalize: (raw) => raw.toLowerCase(),
		validate: (value) => (domainPattern.test(value) ? null : 'Invalid domain format'),
		duplicateMessage: 'Domain already added',
		validateItems: (items) => schemaErrors(googleAllowedDomainsSchema, { allowedDomains: items }),
		saveItems: (items) => saveGoogleAllowedDomains({ allowedDomains: items }),
		saveFailedFallback: 'Failed to save allowed domains'
	}
};

export const oidcProvider: OAuthProviderDescriptor = {
	id: 'oidc',
	name: 'OpenID Connect',
	pageDescription:
		'Configure your OpenID Connect identity provider so its users can sign in with SSO. Anyone the provider issues a token for can sign in — scope access at the provider.',
	callbackDescription:
		'Register this as the redirect URI on the OIDC client at your identity provider.',
	clientIdPlaceholder: 'rootprint',
	clientIdHint:
		'Client ID of the OIDC client registered at your identity provider. Changing it later unlinks every OpenID Connect account and signs those users out.',
	clientSecretHint: 'Client secret of that OIDC client.',
	successToast: 'OpenID Connect authentication settings saved',
	issuer: {
		hint: 'The issuer URL, e.g. https://auth.example.com/realms/main. Discovery is fetched from <issuer>/.well-known/openid-configuration when you save. Changing it later unlinks every OpenID Connect account and signs those users out.',
		placeholder: 'https://auth.example.com/realms/main'
	},
	validateCredentials: (input) => schemaErrors(oidcCredentialsSchema, input),
	saveCredentials: saveOidcCredentials,
	removeCredentials: removeOidcCredentials
};
