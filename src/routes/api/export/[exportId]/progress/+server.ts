import { requireUser } from '$lib/middleware/auth';
import { exportManager } from '$lib/server/services/export.service';
import type { ExportStatus } from '$lib/types';

import type { RequestHandler } from './$types';

type ProgressFrame =
	| { status: Extract<ExportStatus, 'fetching'>; fetched: number; total: number }
	| { status: Extract<ExportStatus, 'compressing' | 'complete'> }
	| { status: Extract<ExportStatus, 'error'>; message: string };

export const GET: RequestHandler = async ({ params }) => {
	const user = requireUser();

	const { exportId } = params;
	const initialState = exportManager.get(exportId);

	if (!initialState || initialState.userId !== user.id) {
		return new Response('Export not found', { status: 404 });
	}

	let intervalId: ReturnType<typeof setInterval>;
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			let lastFrameKey = '';

			function send(frame: ProgressFrame) {
				const key =
					frame.status === 'fetching'
						? `fetching:${frame.fetched}:${frame.total}`
						: frame.status === 'error'
							? `error:${frame.message}`
							: frame.status;
				if (key === lastFrameKey) return;
				lastFrameKey = key;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
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
