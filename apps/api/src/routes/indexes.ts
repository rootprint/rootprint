import { Hono, type MiddlewareHandler } from "hono";
import * as v from "valibot";

import type { AppEnv as BaseEnv } from "../env.js";
import { db } from "../lib/db.js";
import { quickwit } from "../lib/quickwit.js";
import { requireAdmin } from "../middleware/require-admin.js";
import {
  canAccessIndex,
  deleteIndex,
  deleteSource,
  getIndexDetail,
  getIndexFields,
  getIndexSettings,
  listIndexes,
  saveIndexConfig,
  setSourceEnabled,
  type IndexSettings,
} from "../services/index.service.js";
import { getIndex } from "../services/quickwit-index.service.js";
import { indexAccessError, notFound } from "../utils/http-error.js";

type IndexEnv = BaseEnv & {
  Variables: BaseEnv["Variables"] & { indexSettings: IndexSettings };
};

const IndexIdParams = v.object({ indexId: v.pipe(v.string(), v.minLength(1)) });
const SourceParams = v.object({
  indexId: v.pipe(v.string(), v.minLength(1)),
  sourceId: v.pipe(v.string(), v.minLength(1)),
});

const SaveConfigBody = v.object({
  displayName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(128)))),
  visibility: v.optional(v.picklist(["hidden", "admin", "all"])),
  levelField: v.optional(v.pipe(v.string(), v.minLength(1))),
  messageField: v.optional(v.pipe(v.string(), v.minLength(1))),
  tracebackField: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1)))),
  contextFields: v.optional(v.nullable(v.array(v.string()))),
});

const ToggleSourceBody = v.object({ enabled: v.boolean() });

const requireIndexAccess: MiddlewareHandler<IndexEnv> = async (c, next) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  const settings = await getIndexSettings(db, indexId);
  const isAdmin = c.get("session")?.user.role === "admin";
  if (!canAccessIndex(settings.visibility, isAdmin)) {
    throw indexAccessError(isAdmin, "denied");
  }
  const index = await getIndex(quickwit, indexId);
  if (!index) throw indexAccessError(isAdmin, "missing");
  c.set("indexSettings", settings);
  await next();
};

export const indexesRouter = new Hono<IndexEnv>();

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
