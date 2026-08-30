import * as v from 'valibot';

import { FilterSchema } from './filters.js';
import { IndexIdParams } from '../utils/params.js';
import { positiveInt } from '../utils/valibot.js';

export const ALERT_OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;

export const AlertConditionSchema = v.object({
	type: v.literal('count'),
	operator: v.picklist(ALERT_OPERATORS),
	threshold: v.pipe(v.number(), v.integer(), v.minValue(0))
});

const positiveSeconds = v.pipe(v.number(), v.integer(), v.minValue(1));

export const createAlertRuleSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	query: v.string(),
	filters: v.optional(v.array(FilterSchema)),
	condition: AlertConditionSchema,
	windowSeconds: positiveSeconds,
	evaluationIntervalSeconds: positiveSeconds,
	enabled: v.optional(v.boolean())
});

export const patchAlertRuleSchema = v.pipe(
	v.object({
		name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
		query: v.optional(v.string()),
		filters: v.optional(v.array(FilterSchema)),
		condition: v.optional(AlertConditionSchema),
		windowSeconds: v.optional(positiveSeconds),
		evaluationIntervalSeconds: v.optional(positiveSeconds),
		enabled: v.optional(v.boolean())
	}),
	v.check((body) => Object.keys(body).length > 0, 'at least one field is required')
);

export const alertRuleItemParamsSchema = v.object({
	...IndexIdParams.entries,
	alertRuleId: positiveInt('alertRuleId')
});

export type CreateAlertRuleInput = v.InferOutput<typeof createAlertRuleSchema>;
export type PatchAlertRuleInput = v.InferOutput<typeof patchAlertRuleSchema>;
