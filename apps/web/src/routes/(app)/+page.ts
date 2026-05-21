import type { PageLoad } from './$types';
import type {
  FieldConfig,
  HistogramBucket,
  IndexOption,
  LevelBucket,
  LogField,
  LogFieldValueBucket,
  LogHit,
  LogListState,
  TimezoneMode,
  WrapMode
} from '$lib/types';

const LEVELS: LevelBucket[] = [
  { name: 'info', count: 1204 },
  { name: 'warn', count: 84 },
  { name: 'error', count: 12 }
];

const FIELDS: LogField[] = [
  { name: 'service', displayName: 'service', cardinality: 4 },
  { name: 'host', displayName: 'host', cardinality: 9 },
  { name: 'trace_id', displayName: 'trace_id', cardinality: null },
  { name: 'span_id', displayName: 'span_id', cardinality: null },
  { name: 'traceback', displayName: 'traceback', cardinality: 3 },
  { name: 'request.id', displayName: 'request.id', cardinality: null },
  { name: 'request.method', displayName: 'request.method', cardinality: 6 },
  { name: 'request.path', displayName: 'request.path', cardinality: 142 },
  { name: 'response.status', displayName: 'response.status', cardinality: 11 },
  { name: 'attributes.user_id', displayName: 'user_id', cardinality: 320 },
  { name: 'attributes.order_id', displayName: 'order_id', cardinality: 2843 },
  { name: 'error.code', displayName: 'error.code', cardinality: 5 }
];

const HISTOGRAM: HistogramBucket[] = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.UTC(2026, 4, 21, 10, i)).toISOString(),
  count: Math.floor(20 + 80 * Math.abs(Math.sin(i / 3)))
}));

const LOGS: LogHit[] = [
  {
    key: '1',
    timestamp: '2026-05-21T10:42:18.221Z',
    level: 'error',
    message: 'checkout: payment provider timeout (order=8821)',
    raw: { service: 'checkout', order_id: 8821, error: 'timeout' }
  },
  {
    key: '2',
    timestamp: '2026-05-21T10:42:18.103Z',
    level: 'info',
    message: 'order created order=8821 user=12',
    raw: { service: 'orders', order_id: 8821, user_id: 12 }
  },
  {
    key: '3',
    timestamp: '2026-05-21T10:42:17.842Z',
    level: 'warn',
    message: 'slow query 412ms — orders.by_user',
    raw: { service: 'db', query: 'orders.by_user', duration_ms: 412 }
  },
  {
    key: '4',
    timestamp: '2026-05-21T10:42:17.601Z',
    level: 'info',
    message: 'request.served path=/api/checkout status=502',
    raw: { 'request.method': 'POST', 'request.path': '/api/checkout', 'response.status': 502 }
  },
  {
    key: '5',
    timestamp: '2026-05-21T10:42:17.499Z',
    level: 'info',
    message: 'cart.updated user=12 items=3',
    raw: { service: 'cart', user_id: 12, items: 3 }
  },
  {
    key: '6',
    timestamp: '2026-05-21T10:42:17.310Z',
    level: 'info',
    message: 'auth.session.refresh user=12',
    raw: { service: 'auth', user_id: 12 }
  }
];

const INDEXES: IndexOption[] = [
  { id: 'prod-logs', name: 'prod-logs' },
  { id: 'staging-logs', name: 'staging-logs' }
];

const FIELD_CONFIG: FieldConfig = {
  timestampField: 'timestamp',
  levelField: 'level',
  messageField: 'message',
  tracebackField: 'traceback'
};

const FIELD_VALUES: Record<string, LogFieldValueBucket[]> = {
  service: [
    { value: 'orders', count: 480 },
    { value: 'checkout', count: 320 },
    { value: 'cart', count: 280 },
    { value: 'db', count: 220 }
  ],
  host: [
    { value: 'ip-10-0-0-1', count: 180 },
    { value: 'ip-10-0-0-2', count: 165 },
    { value: 'ip-10-0-0-3', count: 152 },
    { value: 'ip-10-0-0-4', count: 148 },
    { value: 'ip-10-0-0-5', count: 144 },
    { value: 'ip-10-0-0-6', count: 132 },
    { value: 'ip-10-0-0-7', count: 128 },
    { value: 'ip-10-0-0-8', count: 124 },
    { value: 'ip-10-0-0-9', count: 117 }
  ],
  traceback: [
    { value: 'ValueError: invalid order id', count: 6 },
    { value: 'TimeoutError: payment provider', count: 4 },
    { value: 'KeyError: missing user', count: 2 }
  ],
  'request.method': [
    { value: 'GET', count: 820 },
    { value: 'POST', count: 320 },
    { value: 'PUT', count: 90 },
    { value: 'DELETE', count: 40 },
    { value: 'PATCH', count: 22 },
    { value: 'OPTIONS', count: 8 }
  ],
  'request.path': [
    '/api/checkout',
    '/api/orders',
    '/api/users/:id',
    '/api/users/:id/orders',
    '/api/carts',
    '/api/carts/:id/items',
    '/api/sessions',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/health',
    '/api/metrics',
    '/api/products',
    '/api/products/:id',
    '/api/products/:id/reviews',
    '/api/inventory',
    '/api/payments',
    '/api/payments/:id',
    '/api/refunds',
    '/api/shipping',
    '/api/shipping/track/:id',
    '/api/webhooks/stripe',
    '/api/webhooks/twilio',
    '/api/admin/users',
    '/api/admin/orders',
    '/api/admin/reports',
    '/api/search',
    '/api/notifications',
    '/api/feature-flags',
    '/api/version'
  ].map((path, i) => ({ value: path, count: Math.max(2, 200 - i * 6) })),
  'response.status': [
    { value: '200', count: 980 },
    { value: '201', count: 120 },
    { value: '204', count: 60 },
    { value: '301', count: 30 },
    { value: '302', count: 22 },
    { value: '400', count: 30 },
    { value: '401', count: 16 },
    { value: '403', count: 10 },
    { value: '404', count: 18 },
    { value: '500', count: 8 },
    { value: '502', count: 6 }
  ],
  'error.code': [
    { value: 'timeout', count: 6 },
    { value: 'refused', count: 3 },
    { value: '5xx', count: 4 },
    { value: 'dns', count: 2 },
    { value: 'tls', count: 1 }
  ],
  'attributes.user_id': [
    { value: '12', count: 220 },
    { value: '87', count: 150 },
    { value: '220', count: 95 },
    { value: '320', count: 60 },
    { value: '410', count: 32 }
  ],
  'attributes.order_id': [
    { value: '8821', count: 28 },
    { value: '8822', count: 24 },
    { value: '8823', count: 18 },
    { value: '8824', count: 14 },
    { value: '8825', count: 10 }
  ],
  trace_id: [],
  span_id: [],
  'request.id': []
};

export const load = (() => ({
  state: 'logs' satisfies LogListState as LogListState,
  indexes: INDEXES,
  selectedIndex: 'prod-logs',
  query: 'level:error AND service:checkout',
  timeRangeLabel: 'last 15m',
  numHits: 1300,
  levels: LEVELS,
  fields: FIELDS,
  histogram: HISTOGRAM,
  logs: LOGS,
  fieldConfig: FIELD_CONFIG,
  isOtelIndex: true,
  fieldValues: FIELD_VALUES,
  timezoneMode: 'local' satisfies TimezoneMode as TimezoneMode,
  wrapMode: 'none' satisfies WrapMode as WrapMode,
  history: [] as unknown[],
  savedQueries: [] as unknown[],
  sharedQueries: [] as unknown[]
})) satisfies PageLoad;
