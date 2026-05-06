export const AUTH_PATHS = ['/auth/sign-in', '/auth/setup', '/api/auth/sign-in'];

export const SETUP_ADMIN_PATH = '/auth/setup-admin';
export const API_AUTH_PREFIX = '/api/auth';

// Prefixes the global session gate in hooks.server.ts does not enforce on.
// /auth/* are sign-in / setup pages; /api/* handlers manage their own auth
// (token-based for ingest, requireUser() for the rest) so they can return
// their own 401 JSON instead of an HTML 302.
export const AUTH_GATE_BYPASS_PREFIXES = ['/auth/', '/api/'];
