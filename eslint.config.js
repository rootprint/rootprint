import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default defineConfig(
	// Base configs (D-05)
	js.configs.recommended,
	ts.configs.strict,
	svelte.configs.recommended,
	svelte.configs.prettier,

	// Global settings
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},

	// TypeScript naming conventions (D-06)
	{
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'variable',
					format: ['camelCase', 'UPPER_CASE'],
					leadingUnderscore: 'allow'
				},
				{
					selector: 'function',
					format: ['camelCase'],
					leadingUnderscore: 'allow'
				},
				{
					selector: 'typeLike',
					format: ['PascalCase']
				},
				{
					selector: 'variable',
					modifiers: ['destructured'],
					format: null
				}
			]
		}
	},

	// Svelte files
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},

	// Import sorting (D-07)
	{
		plugins: {
			'simple-import-sort': simpleImportSort
		},
		rules: {
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error'
		}
	},

	// Global rule overrides
	{
		rules: {
			// D-08: No console/debugger rules in Phase 1
			'no-console': 'off',
			'no-debugger': 'off',

			// D-02: Disable rules that clash with established Svelte/SvelteKit patterns
			// All navigation in this app uses static routes; resolve() adds boilerplate for no benefit
			'svelte/no-navigation-without-resolve': 'off',
			// {@html} is used intentionally for server-rendered traceback highlighting
			'svelte/no-at-html-tags': 'off',
			// Many Set/Map/Date usages are inside $derived.by() or functions (local computation,
			// not reactive state). Too many false positives in this codebase pattern.
			'svelte/prefer-svelte-reactivity': 'off',
			// Existing $state + $effect pattern works correctly; writable $derived is a newer
			// alternative, not a requirement
			'svelte/prefer-writable-derived': 'off',

			// Allow unused variables prefixed with _ (common pattern for destructured rest)
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_'
				}
			]
		}
	},

	// Ignore patterns
	{
		ignores: [
			'.svelte-kit/',
			'build/',
			'node_modules/',
			'data/',
			'.quickwit/',
			'drizzle/',
			'site/**',
			'docs-site/**'
		]
	},

	// Prettier compat MUST be last (Pitfall 6 from research)
	eslintConfigPrettier
);
