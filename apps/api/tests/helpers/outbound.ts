type Handler = (req: Request) => Response | Promise<Response>;

const routes = new Map<string, Handler>();
const realFetch = globalThis.fetch;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function urlOf(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

export function installOutboundInterceptor(): void {
	const intercepting = (input: RequestInfo | URL, init?: RequestInit) => {
		const u = new URL(urlOf(input));
		const handler = routes.get(`${u.hostname}${u.pathname}`);
		if (handler) return Promise.resolve(handler(new Request(input, init)));
		// Only the API under test, the fake IdP and Quickwit live on loopback; anything else
		// means a provider path changed and the mock no longer matches.
		if (!LOOPBACK.has(u.hostname)) {
			return Promise.reject(new Error(`unmocked outbound request: ${u.hostname}${u.pathname}`));
		}
		return realFetch(input, init);
	};
	globalThis.fetch = intercepting as unknown as typeof fetch;
}

/** Key is `hostname + pathname`, e.g. `api.github.com/user`. */
export function interceptOutbound(hostPath: string, handler: Handler): void {
	routes.set(hostPath, handler);
}

export function resetOutbound(): void {
	routes.clear();
}
