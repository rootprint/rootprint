import { requireUser } from '$lib/middleware/auth';
import { exportManager } from '$lib/server/services/export.service';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const user = requireUser();

	const { exportId } = params;
	const state = exportManager.get(exportId);

	if (!state || state.status !== 'complete' || !state.result || state.userId !== user.id) {
		return new Response('Export not found or not ready', { status: 404 });
	}

	const response = new Response(state.result as BodyInit, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': `attachment; filename="${state.filename}"`,
			'Content-Length': state.result.byteLength.toString()
		}
	});

	exportManager.delete(exportId);

	return response;
};
