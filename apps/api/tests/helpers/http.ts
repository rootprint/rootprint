import { BASE_URL } from './env.js';

type JsonBody = Record<string, unknown>;
type Init = Omit<RequestInit, 'body'> & { body?: BodyInit; json?: JsonBody };

const octet = () => Math.floor(Math.random() * 254) + 1;

/** One client identity: its own cookies and its own X-Forwarded-For address. */
export class Jar {
	readonly cookies = new Map<string, string>();
	readonly ip = `10.${octet()}.${octet()}.${octet()}`;

	async fetch(path: string, init: Init = {}): Promise<Response> {
		const { json, ...rest } = init;
		const headers = new Headers(rest.headers);
		headers.set('x-forwarded-for', this.ip);
		// An explicitly empty Origin means "send none"; otherwise default to our own origin.
		if (headers.get('origin') === '') headers.delete('origin');
		else if (!headers.has('origin')) headers.set('origin', BASE_URL);
		if (this.cookies.size) {
			headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
		}
		let body = rest.body;
		if (json !== undefined) {
			headers.set('content-type', 'application/json');
			body = JSON.stringify(json);
		}
		const url = path.startsWith('http') ? path : BASE_URL + path;
		const res = await fetch(url, { ...rest, headers, body, redirect: 'manual' });
		for (const raw of res.headers.getSetCookie()) {
			const [pair = '', ...attrs] = raw.split(';');
			const eq = pair.indexOf('=');
			const name = pair.slice(0, eq).trim();
			const value = pair.slice(eq + 1).trim();
			const cleared = value === '' || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a));
			if (cleared) this.cookies.delete(name);
			else this.cookies.set(name, value);
		}
		return res;
	}

	get(path: string, init?: Init) {
		return this.fetch(path, { ...init, method: 'GET' });
	}
	post(path: string, json?: JsonBody, init?: Init) {
		return this.fetch(path, { ...init, method: 'POST', json });
	}
	put(path: string, json?: JsonBody, init?: Init) {
		return this.fetch(path, { ...init, method: 'PUT', json });
	}
	delete(path: string, init?: Init) {
		return this.fetch(path, { ...init, method: 'DELETE' });
	}
}

export async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
	return (await res.json()) as T;
}

/** Body shape of every non-Better-Auth error: `{ error: { code, message, statusCode, requestId } }`. */
export async function errorCode(res: Response): Promise<string> {
	const body = await json<{ error: { code: string } }>(res);
	return body.error.code;
}
