export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, value] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
