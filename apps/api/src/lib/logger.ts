import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	...(isDev
		? {
				transport: {
					target: 'pino-pretty',
					options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' }
				}
			}
		: {})
});

export type Logger = typeof logger;
