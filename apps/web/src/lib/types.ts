import type { InferResponseType } from "hono/client";

import type { client } from "$lib/api/client";

export type UserView = InferResponseType<typeof client.api.users.$get, 200>[number];

export type GoogleAuthSettingsView = InferResponseType<typeof client.api.settings.auth.google.$get, 200>;

export type IndexTabId = 'config' | 'fields' | 'sources';

export type IngestTokenView = InferResponseType<typeof client.api['ingest-tokens']['$get'], 200>[number];
