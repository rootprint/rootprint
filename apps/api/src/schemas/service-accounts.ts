import * as v from 'valibot';

import { boundedName } from './names.js';

export const createServiceAccountSchema = v.object({
	name: boundedName('Name', 128)
});
export type CreateServiceAccountInput = v.InferOutput<typeof createServiceAccountSchema>;
