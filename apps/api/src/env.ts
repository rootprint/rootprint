import type { Logger } from './lib/logger.js';
import type { Session } from './lib/auth.js';
import type { VerifiedIngestToken } from './services/ingest-token.service.js';

export type AppEnv = {
  Variables: {
    requestId: string;
    logger: Logger;
    session?: Session;
    token?: VerifiedIngestToken;
  };
};
