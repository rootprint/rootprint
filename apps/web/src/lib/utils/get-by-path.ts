export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  // Direct key first so Quickwit flat dotted keys (e.g. "body.message") win over nested walks.
  if (path in obj) return obj[path];
  const segments = path.split('.');
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}
