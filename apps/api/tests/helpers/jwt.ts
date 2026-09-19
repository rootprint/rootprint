const enc = new TextEncoder();

export function b64url(data: ArrayBuffer | Uint8Array | string): string {
	const bytes =
		typeof data === 'string'
			? enc.encode(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data);
	return Buffer.from(bytes).toString('base64url');
}

export async function sha256b64url(value: string): Promise<string> {
	return b64url(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

export type Signer = {
	jwk: JsonWebKey & { kid: string };
	sign(claims: Record<string, unknown>): Promise<string>;
};

export async function createSigner(kid = 'test-key'): Promise<Signer> {
	const { privateKey, publicKey } = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	);
	const jwk: JsonWebKey & { kid: string } = {
		...(await crypto.subtle.exportKey('jwk', publicKey)),
		kid,
		alg: 'RS256',
		use: 'sig'
	};
	return {
		jwk,
		async sign(claims) {
			const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
			const payload = b64url(JSON.stringify(claims));
			const sig = await crypto.subtle.sign(
				'RSASSA-PKCS1-v1_5',
				privateKey,
				enc.encode(`${header}.${payload}`)
			);
			return `${header}.${payload}.${b64url(sig)}`;
		}
	};
}
