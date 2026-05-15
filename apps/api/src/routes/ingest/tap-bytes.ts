export function tapBytes(input: ReadableStream<Uint8Array>): {
	body: ReadableStream<Uint8Array>;
	sawAnyBytes: () => boolean;
} {
	let seen = false;
	const body = input.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, ctrl) {
				if (chunk.byteLength > 0) seen = true;
				ctrl.enqueue(chunk);
			}
		})
	);
	return { body, sawAnyBytes: () => seen };
}
