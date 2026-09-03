import * as v from 'valibot';

import { PRESET_OPTIONS } from '../constants.js';
import type { TimeRange } from '../types.js';
import { epochSeconds } from '../utils/valibot.js';

export const TimeRangeSchema: v.GenericSchema<TimeRange> = v.variant('type', [
	v.object({
		type: v.literal('relative'),
		preset: v.picklist(PRESET_OPTIONS)
	}),
	v.pipe(
		v.object({
			type: v.literal('absolute'),
			start: epochSeconds,
			end: epochSeconds
		}),
		v.check((r) => r.end > r.start, 'end must be greater than start')
	)
]);
