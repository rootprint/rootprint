import { config } from '../config.js';
import { createDb, type Db } from '../db/index.js';

export const db: Db = createDb(config.databaseUrl);
