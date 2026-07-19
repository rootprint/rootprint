import type { PageLoad } from './$types';
import { getClusterDocumentStatus } from '$lib/api/admin';
import type { IndexOption } from '$lib/types';
import { listIndexes } from '$lib/api/indexes';
import { readString, writeString } from '$lib/utils/safe-storage';

const HAS_SEEN_DOCUMENTS_KEY = 'rootprint:has-seen-documents';

export const load = (async ({ parent }) => {
	const { session } = await parent();
	const hasSeenDocuments = readString(HAS_SEEN_DOCUMENTS_KEY) === '1';
	const documentStatusPromise =
		session?.user.role === 'admin' && !hasSeenDocuments
			? getClusterDocumentStatus().catch(() => null)
			: Promise.resolve(null);
	const [summaries, documentStatus] = await Promise.all([listIndexes(), documentStatusPromise]);
	if (documentStatus?.hasDocuments === true) writeString(HAS_SEEN_DOCUMENTS_KEY, '1');

	const indexes: IndexOption[] = summaries.map((s) => ({
		id: s.indexId,
		name: s.displayName ?? s.indexId
	}));
	return {
		indexes,
		hasDocuments: hasSeenDocuments ? true : (documentStatus?.hasDocuments ?? null)
	};
}) satisfies PageLoad;
