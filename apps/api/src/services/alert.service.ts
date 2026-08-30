import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { alertRule } from '../db/schema.js';
import type { CreateAlertRuleInput, PatchAlertRuleInput } from '../schemas/alerts.js';
import type { AlertRule } from '../types.js';
import { withUniqueViolation } from '../utils/db.js';
import { internal, notFound } from '../utils/http-error.js';

type AlertRuleRow = typeof alertRule.$inferSelect;

const NAME_TAKEN_CODE = 'ALERT_RULE_NAME_TAKEN';
const NAME_TAKEN_MSG = 'An alert rule with this name already exists for this index';

function toPublic(row: AlertRuleRow): AlertRule {
	return {
		id: row.id,
		indexId: row.indexId,
		name: row.name,
		query: row.query,
		filters: row.filters,
		condition: row.condition,
		windowSeconds: row.windowSeconds,
		evaluationIntervalSeconds: row.evaluationIntervalSeconds,
		enabled: row.enabled,
		createdByUserId: row.createdByUserId,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString()
	};
}

export async function listAlertRules(db: Db, indexId: string): Promise<AlertRule[]> {
	const rows = await db
		.select()
		.from(alertRule)
		.where(eq(alertRule.indexId, indexId))
		.orderBy(desc(alertRule.updatedAt));
	return rows.map(toPublic);
}

export async function getAlertRule(db: Db, indexId: string, id: number): Promise<AlertRule> {
	const [row] = await db
		.select()
		.from(alertRule)
		.where(and(eq(alertRule.id, id), eq(alertRule.indexId, indexId)))
		.limit(1);
	if (!row) throw notFound('Alert rule not found');
	return toPublic(row);
}

export async function createAlertRule(
	db: Db,
	indexId: string,
	createdByUserId: string,
	input: CreateAlertRuleInput
): Promise<AlertRule> {
	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.insert(alertRule)
			.values({ indexId, createdByUserId, ...input })
			.returning()
	);
	if (!row) throw internal('Failed to create alert rule');
	return toPublic(row);
}

export async function updateAlertRule(
	db: Db,
	indexId: string,
	id: number,
	patch: PatchAlertRuleInput
): Promise<AlertRule> {
	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.update(alertRule)
			.set(patch)
			.where(and(eq(alertRule.id, id), eq(alertRule.indexId, indexId)))
			.returning()
	);
	if (!row) throw notFound('Alert rule not found');
	return toPublic(row);
}

export async function deleteAlertRule(db: Db, indexId: string, id: number): Promise<void> {
	const [row] = await db
		.delete(alertRule)
		.where(and(eq(alertRule.id, id), eq(alertRule.indexId, indexId)))
		.returning({ id: alertRule.id });
	if (!row) throw notFound('Alert rule not found');
}
