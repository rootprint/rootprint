import { conflict, isUniqueViolation } from './http-error.js';

export async function withUniqueViolation<T>(
	message: string,
	code: string,
	fn: () => Promise<T>
): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (isUniqueViolation(err)) throw conflict(message, code);
		throw err;
	}
}
