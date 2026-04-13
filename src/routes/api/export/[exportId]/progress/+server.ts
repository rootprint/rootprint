import type { RequestHandler } from '@sveltejs/kit';

import { exportManager } from '$lib/server/services/export.service';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const exportId = params.exportId ?? '';
	const initialState = exportManager.get(exportId);

	if (!initialState || initialState.userId !== locals.user.id) {
		return new Response('Export not found', { status: 404 });
	}

	let intervalId: ReturnType<typeof setInterval>;
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			function send(data: Record<string, unknown>) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			}

			function poll() {
				const state = exportManager.get(exportId);

				if (!state) {
					send({ status: 'error', message: 'Export no longer exists' });
					clearInterval(intervalId);
					controller.close();
					return;
				}

				if (state.status === 'pending' || state.status === 'fetching') {
					send({ status: 'fetching', fetched: state.fetched, total: state.total });
				} else if (state.status === 'compressing') {
					send({ status: 'compressing' });
				} else if (state.status === 'complete') {
					send({ status: 'complete' });
					clearInterval(intervalId);
					controller.close();
				} else if (state.status === 'error') {
					send({ status: 'error', message: state.error ?? 'Unknown error' });
					clearInterval(intervalId);
					controller.close();
				}
			}

			poll();
			intervalId = setInterval(poll, 500);
		},
		cancel() {
			clearInterval(intervalId);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
