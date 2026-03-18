<script lang="ts">
	type Token = { type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace'; value: string };

	const TOKEN_RE = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\]:,]|\s+/g;

	const CLASS_MAP: Record<Token['type'], string> = {
		key: 'text-info',
		string: 'text-success',
		number: 'text-warning',
		boolean: 'text-error',
		null: 'text-base-content/50',
		punctuation: 'text-base-content/30',
		whitespace: ''
	};

	let { code }: { code: string } = $props();

	function tokenize(json: string): Token[] {
		const tokens: Token[] = [];
		let match;
		TOKEN_RE.lastIndex = 0;
		while ((match = TOKEN_RE.exec(json)) !== null) {
			const value = match[0];
			let type: Token['type'];
			if (value.startsWith('"')) type = 'string';
			else if (/^-?\d/.test(value)) type = 'number';
			else if (value === 'true' || value === 'false') type = 'boolean';
			else if (value === 'null') type = 'null';
			else if (/^\s+$/.test(value)) type = 'whitespace';
			else type = 'punctuation';
			tokens.push({ type, value });
		}
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === 'string') {
				for (let j = i + 1; j < tokens.length; j++) {
					if (tokens[j].type === 'whitespace') continue;
					if (tokens[j].type === 'punctuation' && tokens[j].value === ':') {
						tokens[i].type = 'key';
					}
					break;
				}
			}
		}
		return tokens;
	}

	let tokens = $derived(tokenize(code.trimEnd()));
</script>

{#if tokens.length}
	<pre class="break-all whitespace-pre-wrap">{#each tokens as token}<span class={CLASS_MAP[token.type]}>{token.value}</span>{/each}</pre>
{:else}
	<pre class="break-all whitespace-pre-wrap">{code}</pre>
{/if}
