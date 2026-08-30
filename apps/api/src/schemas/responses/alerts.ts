import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';
import { AlertConditionSchema } from '../alerts.js';
import { FilterSchema } from '../filters.js';

export const AlertRuleResponse = named(
	'AlertRuleResponse',
	v.object({
		id: v.number(),
		indexId: v.string(),
		name: v.string(),
		query: v.string(),
		filters: v.array(FilterSchema),
		condition: AlertConditionSchema,
		windowSeconds: v.number(),
		evaluationIntervalSeconds: v.number(),
		enabled: v.boolean(),
		createdByUserId: v.nullable(v.string()),
		createdAt: isoTimestampString,
		updatedAt: isoTimestampString
	})
);

export const AlertRuleListResponse = v.array(AlertRuleResponse);
