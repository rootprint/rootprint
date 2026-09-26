import type * as v from 'valibot';

import type { Preset } from './constants.js';

export type { Preset };
import type {
	DynamicMappingSchema,
	IndexDetailResponse as IndexDetailResponseSchema,
	IndexListResponse as IndexListResponseSchema,
	IndexSourceSchema,
	PreferencesResponse as PreferencesResponseSchema,
	SourceDetailSchema as SourceDetailResponseSchema
} from './schemas/responses/indexes.js';
import type { TraceResponseSchema, TraceSpanSchema } from './schemas/responses/traces.js';
import type { SavedViewResponse as SavedViewResponseSchema } from './schemas/responses/views.js';
import type { AuthProvidersResponse as AuthProvidersResponseSchema } from './schemas/responses/auth.js';
import type { ExportFormatSchema } from './schemas/export.js';
import type { DisplayModeSchema } from './schemas/display-mode.js';
import type { SortDirectionSchema } from './schemas/filters.js';

// Only what apps/web imports. Server-only types live beside the code that produces them.

export type ApiErrorDetail = {
	path: string;
	message: string;
};

export type ApiErrorBody = {
	error: {
		code: string;
		message: string;
		statusCode: number;
		requestId: string;
		details?: ApiErrorDetail[];
	};
};

export type DynamicMapping = v.InferOutput<typeof DynamicMappingSchema>;

export type IndexSource = v.InferOutput<typeof IndexSourceSchema>;

export type SourceDetail = v.InferOutput<typeof SourceDetailResponseSchema>;

export type IndexSummary = v.InferOutput<typeof IndexListResponseSchema>[number];

export type IndexDetail = v.InferOutput<typeof IndexDetailResponseSchema>;

export type Filter = {
	field: string;
	value: string;
	/** When true, the composed query negates this clause (NOT field:"value"). */
	exclude: boolean;
};

export type SortDirection = v.InferOutput<typeof SortDirectionSchema>;

export type TimeRange =
	{ type: 'relative'; preset: Preset } | { type: 'absolute'; start: number; end: number };

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'expired';

export type { CreateApiKeyInput } from './schemas/api-keys.js';

export type SavedView = v.InferOutput<typeof SavedViewResponseSchema>;

export type DisplayMode = v.InferOutput<typeof DisplayModeSchema>;

export type Preferences = v.InferOutput<typeof PreferencesResponseSchema>;

export type AuthProvidersInfo = v.InferOutput<typeof AuthProvidersResponseSchema>;

export type ExternalProviderId = Exclude<keyof AuthProvidersInfo, 'password'>;

export type ExportFormat = v.InferOutput<typeof ExportFormatSchema>;

export type TraceSpan = v.InferOutput<typeof TraceSpanSchema>;

export type TraceResponse = v.InferOutput<typeof TraceResponseSchema>;
