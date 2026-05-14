import { Hono } from "hono";
import * as v from "valibot";

import { INDEX_VISIBILITIES } from "../constants/index-visibility.js";
import type { AppEnv } from "../env.js";
import { db } from "../lib/db.js";
import { quickwit } from "../lib/quickwit.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireIndexAccess } from "../middleware/require-index-access.js";
import {
  deleteIndex,
  deleteSource,
  getIndexDetail,
  getIndexFields,
  listIndexes,
  saveIndexConfig,
  setSourceEnabled,
} from "../services/index.service.js";
import { notFound } from "../utils/http-error.js";
import { IndexIdParams } from "../utils/params.js";

const SourceParams = v.object({
  indexId: v.pipe(v.string(), v.minLength(1)),
  sourceId: v.pipe(v.string(), v.minLength(1)),
});

const SaveConfigBody = v.object({
  displayName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(128)))),
  visibility: v.optional(v.picklist(INDEX_VISIBILITIES)),
  levelField: v.optional(v.pipe(v.string(), v.minLength(1))),
  messageField: v.optional(v.pipe(v.string(), v.minLength(1))),
  tracebackField: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1)))),
  contextFields: v.optional(v.nullable(v.array(v.string()))),
});

const ToggleSourceBody = v.object({ enabled: v.boolean() });

export const indexesRouter = new Hono<AppEnv>();

indexesRouter.get("/", async (c) =>
  c.json(await listIndexes(db, quickwit, c.get("session")?.user.role)),
);

indexesRouter.get("/:indexId/fields", requireIndexAccess, async (c) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  return c.json(await getIndexFields(quickwit, indexId));
});

indexesRouter.get("/:indexId/config", requireIndexAccess, requireAdmin, async (c) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  const detail = await getIndexDetail(db, quickwit, indexId);
  if (!detail) throw notFound("Index not found");
  return c.json(detail);
});

indexesRouter.patch("/:indexId/config", requireIndexAccess, requireAdmin, async (c) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  const body = v.parse(SaveConfigBody, await c.req.json());
  await saveIndexConfig(db, indexId, body);
  return c.body(null, 204);
});

indexesRouter.delete("/:indexId", requireIndexAccess, requireAdmin, async (c) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  await deleteIndex(db, quickwit, indexId);
  return c.body(null, 204);
});

indexesRouter.patch(
  "/:indexId/sources/:sourceId",
  requireIndexAccess,
  requireAdmin,
  async (c) => {
    const { indexId, sourceId } = v.parse(SourceParams, c.req.param());
    const { enabled } = v.parse(ToggleSourceBody, await c.req.json());
    await setSourceEnabled(quickwit, indexId, sourceId, enabled);
    return c.body(null, 204);
  },
);

indexesRouter.delete(
  "/:indexId/sources/:sourceId",
  requireIndexAccess,
  requireAdmin,
  async (c) => {
    const { indexId, sourceId } = v.parse(SourceParams, c.req.param());
    await deleteSource(quickwit, indexId, sourceId);
    return c.body(null, 204);
  },
);
