import { hc } from 'hono/client';
import type { AppType } from 'api';

export const api = hc<AppType>('');
