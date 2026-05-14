// apps/api/src/types.ts
// Shared TypeScript types consumed by both the api itself and downstream
// workspace packages. Pure types only — no runtime exports.
export type HealthResponse = {
  status: 'ok';
};

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

export type IndexVisibility = 'hidden' | 'admin' | 'all';

export type IndexField = {
  name: string;
  type: string;
  fast: boolean | null;
};

export type IndexSource = {
  sourceId: string;
  sourceType: string;
  enabled: boolean;
};

export type IndexSummary = {
  indexId: string;
  displayName: string | null;
  visibility: IndexVisibility;
  fieldCount: number;
  sourceCount: number;
  mode: string | null;
  createTimestamp: number | null;
};

export type IndexDetail = {
  indexId: string;
  displayName: string | null;
  visibility: IndexVisibility;
  levelField: string;
  messageField: string;
  tracebackField: string | null;
  contextFields: string[] | null;
  indexUri: string | null;
  timestampField: string | null;
  mode: string | null;
  tagFields: string[] | null;
  defaultSearchFields: string[] | null;
  storeSource: boolean | null;
  fields: IndexField[];
  sources: IndexSource[];
};

export type SaveIndexConfigFields = {
  displayName?: string | null;
  visibility?: IndexVisibility;
  levelField?: string;
  messageField?: string;
  tracebackField?: string | null;
  contextFields?: string[] | null;
};

export type LogHit = Record<string, unknown>;

export type LogSearchResponse = {
  hits: LogHit[];
  numHits: number;
  elapsedTimeMicros: number;
};

export type HistogramBucket = {
  key: number;
  keyAsString: string;
  docCount: number;
};

export type HistogramResponse = {
  buckets: HistogramBucket[];
};

export type FieldValueEntry = {
  value: string;
  count: number;
};

export type FieldValuesResponse = {
  values: FieldValueEntry[];
};

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'expired';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  lastActive: Date | null;
  status: UserStatus;
  hasCredentialAccount: boolean;
  inviteUrl: string | null;
  inviteExpiresAt: Date | null;
};

export type IngestTokenSummary = {
  id: number;
  name: string;
  tokenPrefix: string;
  indexId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdByUserId: string;
};

export type CreateIngestTokenInput = {
  name: string;
  indexId: string;
};

export type IngestTokenValue = {
  token: string;
};

export type SavedQuery = {
  id: number;
  indexName: string;
  name: string;
  description: string | null;
  query: string;
  createdAt: Date;
  updatedAt: Date;
};
