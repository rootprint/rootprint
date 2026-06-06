import * as v from 'valibot';

export const SOURCE_TYPES = ['kinesis', 'file'] as const;

export const SOURCE_INPUT_FORMATS = [
	'json',
	'plain_text',
	'otlp_logs_json',
	'otlp_logs_protobuf',
	'otlp_traces_json',
	'otlp_traces_protobuf'
] as const;

export const FILE_MESSAGE_TYPES = ['s3_notification', 'raw_uri'] as const;

const sourceId = v.pipe(
	v.string(),
	v.regex(
		/^[a-zA-Z][a-zA-Z0-9_-]{2,254}$/,
		'Source ID must start with a letter and be 3–255 characters (letters, digits, - or _).'
	)
);

const inputFormat = v.optional(v.picklist(SOURCE_INPUT_FORMATS));

const numPipelines = v.optional(
	v.pipe(v.number('Number of pipelines must be a number.'), v.integer(), v.minValue(1))
);

const vrlScript = v.optional(
	v.pipe(
		v.string(),
		v.check((s) => s.trim().length > 0, 'VRL script cannot be empty.')
	)
);

// Shared, type-specific param fields (reused by create + update).
const kinesisFields = {
	inputFormat,
	numPipelines,
	vrlScript,
	streamName: v.pipe(v.string(), v.minLength(1, 'Stream name is required.')),
	region: v.optional(v.pipe(v.string(), v.minLength(1))),
	endpoint: v.optional(v.pipe(v.string(), v.minLength(1)))
};

const fileFields = {
	inputFormat,
	numPipelines,
	vrlScript,
	queueUrl: v.pipe(v.string(), v.minLength(1, 'SQS queue URL is required.')),
	messageType: v.optional(v.picklist(FILE_MESSAGE_TYPES), 's3_notification')
};

// --- Create (includes sourceId) ---
const kinesisSource = v.pipe(
	v.object({ sourceId, sourceType: v.literal('kinesis'), ...kinesisFields }),
	v.forward(
		v.check(
			(input) => !(input.region && input.endpoint),
			'Specify either a region or an endpoint, not both.'
		),
		['endpoint']
	)
);

const fileSource = v.object({ sourceId, sourceType: v.literal('file'), ...fileFields });

export const createSourceSchema = v.variant('sourceType', [kinesisSource, fileSource]);

export type CreateSourceInput = v.InferOutput<typeof createSourceSchema>;

// --- Update (no sourceId — it is the immutable path identifier) ---
const kinesisUpdate = v.pipe(
	v.object({ sourceType: v.literal('kinesis'), ...kinesisFields }),
	v.forward(
		v.check(
			(input) => !(input.region && input.endpoint),
			'Specify either a region or an endpoint, not both.'
		),
		['endpoint']
	)
);

const fileUpdate = v.object({ sourceType: v.literal('file'), ...fileFields });

export const updateSourceSchema = v.variant('sourceType', [kinesisUpdate, fileUpdate]);

export type UpdateSourceInput = v.InferOutput<typeof updateSourceSchema>;
