import type { RequestHandler } from '@sveltejs/kit';

import { exportManager } from '$lib/server/services/export.service';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const exportId = params.exportId!;
	const state = exportManager.get(exportId);

	if (!state || state.status !== 'complete' || !state.result || state.userId !== locals.user.id) {
		return new Response('Export not found or not ready', { status: 404 });
	}

	const response = new Response(state.result as BodyInit, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': `attachment; filename="${state.filename}"`,
			'Content-Length': state.result.byteLength.toString()
		}
	});

	// Clean up after serving
	exportManager.delete(exportId);

	return response;
};
