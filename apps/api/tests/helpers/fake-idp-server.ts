import { startFakeIdp } from './fake-idp.js';

const idp = await startFakeIdp({ port: Number(process.env.FAKE_IDP_PORT ?? 18284) });
console.log(`fake idp listening at ${idp.issuer}`);
