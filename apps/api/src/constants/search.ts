/** Hard cap on the per-field terms aggregation size accepted by `GET /api/indexes/:indexId/fields/:field/values`. */
export const FIELD_VALUES_MAX = 10_000;

/** Fallback `limit` for the field-values endpoint when the caller doesn't pass one. */
export const FIELD_VALUES_DEFAULT = 100;
