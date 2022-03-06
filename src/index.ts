import { Certificate } from './lib/entities/Certificate';
import { IdentityPublicKey } from './lib/entities/IdentityPublicKey';
import { PrivateKey } from './lib/entities/PrivateKey';
import { SessionPublicKey } from './lib/entities/SessionPublicKey';

export { DBCertificateStore } from './lib/DBCertificateStore';
export { DBPrivateKeyStore } from './lib/DBPrivateKeyStore';
export { DBPublicKeyStore } from './lib/DBPublicKeyStore';

export { Certificate, PrivateKey, IdentityPublicKey, SessionPublicKey };
// noinspection JSUnusedGlobalSymbols
export const ENTITIES: ReadonlyArray<new () => any> = [
  Certificate,
  PrivateKey,
  IdentityPublicKey,
  SessionPublicKey,
];
