import type { InferResponseType } from "hono/client";

import type { api } from "$lib/api/client";

export type UserView = InferResponseType<typeof api.api.users.$get>[number];

export type GoogleAuthSettingsView = InferResponseType<typeof api.api.settings.auth.google.$get>;

export type IndexTabId = 'config' | 'fields' | 'sources';

export type IngestTokenView = InferResponseType<typeof api.api['ingest-tokens']['$get']>[number];
