import { QuickwitClient } from 'quickwit-js';

import { config } from '../config.js';

export const quickwit = new QuickwitClient({ endpoint: config.quickwitUrl });
