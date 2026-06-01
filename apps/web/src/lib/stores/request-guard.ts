export class RequestGuard {
	#id = 0;

	/** Begin a new request and return its token. */
	next(): number {
		return ++this.#id;
	}

	/** True when `token` is still the most recently started request. */
	isCurrent(token: number): boolean {
		return token === this.#id;
	}
}
