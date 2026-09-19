export const API_PORT = Number(process.env.TEST_API_PORT ?? 18282);
export const BASE_URL = `http://127.0.0.1:${API_PORT}`;
export const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ?? 'postgres://rootprint:rootprint@localhost:5432/rootprint_test';
export const QUICKWIT_URL = process.env.TEST_QUICKWIT_URL ?? 'http://127.0.0.1:7290';
