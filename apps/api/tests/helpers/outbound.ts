type Handler = (req: Request) => Response | Promise<Response>;

const routes = new Map<string, Handler>();
const realFetch = globalThis.fetch;

function urlOf(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

export function installOutboundInterceptor(): void {
	const intercepting = (input: RequestInfo | URL, init?: RequestInit) => {
		const u = new URL(urlOf(input));
		const handler = routes.get(`${u.hostname}${u.pathname}`);
		return handler ? Promise.resolve(handler(new Request(input, init))) : realFetch(input, init);
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
