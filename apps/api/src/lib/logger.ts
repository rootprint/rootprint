import pino from 'pino';

export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	base: { service: 'rootprint-api' },
	serializers: {
		err: pino.stdSerializers.err
	}
});
