import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import { LAST_USED_THROTTLE_SECONDS } from '../constants/tokens.js';
import type { Db } from '../db/index.js';
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

type TableWithLastUsed = PgTable & {
	id: AnyPgColumn;
	lastUsedAt: AnyPgColumn;
};

export function touchLastUsed(db: Db, table: TableWithLastUsed, id: number): void {
	db.update(table)
		.set({ lastUsedAt: sql`now()` })
		.where(
			and(
				eq(table.id, id),
				or(
					isNull(table.lastUsedAt),
					sql`${table.lastUsedAt} < now() - make_interval(secs => ${LAST_USED_THROTTLE_SECONDS})`
				)
			)
		)
		.catch(() => {});
}
