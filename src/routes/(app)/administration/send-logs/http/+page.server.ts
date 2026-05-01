import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';
import { getLatestIngestTokenForIndex } from '$lib/server/services/ingest-token.service';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { origin, indexes } = await parent();

	const accessibleIndexIds = indexes.map((i) => i.indexId);
	const requested = url.searchParams.get('index');
	const selectedIndexId =
		requested && accessibleIndexIds.includes(requested)
			? requested
			: accessibleIndexIds.includes(DEFAULT_OTEL_LOGS_INDEX_ID)
				? DEFAULT_OTEL_LOGS_INDEX_ID
				: (accessibleIndexIds[0] ?? null);

	if (!selectedIndexId) {
		return { selectedIndexId: null, accessibleIndexIds };
	}

	const token = getLatestIngestTokenForIndex(selectedIndexId);
	if (!token) {
		return { selectedIndexId, accessibleIndexIds, token: null };
	}

	const endpointUrl = `${origin}/api/ingest/${encodeURIComponent(selectedIndexId)}?commit=wait_for`;

	const curl = `curl -X POST '${endpointUrl}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/x-ndjson' \\
  --data-binary @- <<'EOF'
{"ts":"2026-04-20T10:00:00Z","service":"cart","msg":"order placed","order_id":"abc"}
{"ts":"2026-04-20T10:00:01Z","service":"cart","msg":"payment ok","order_id":"abc"}
EOF`;

	return {
		selectedIndexId,
		accessibleIndexIds,
		token,
		endpointUrl,
		snippets: {
			curl: await snippet(curl, 'bash')
		}
	};
};
