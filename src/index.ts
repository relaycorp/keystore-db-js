import { Certificate } from './lib/entities/Certificate';
import { IdentityPrivateKey } from './lib/entities/IdentityPrivateKey';
import { IdentityPublicKey } from './lib/entities/IdentityPublicKey';
import { SessionPrivateKey } from './lib/entities/SessionPrivateKey';
import { SessionPublicKey } from './lib/entities/SessionPublicKey';

export { DBCertificateStore } from './lib/DBCertificateStore';
export { DBPrivateKeyStore } from './lib/DBPrivateKeyStore';
export { DBPublicKeyStore } from './lib/DBPublicKeyStore';

export { Certificate, IdentityPrivateKey, IdentityPublicKey, SessionPrivateKey, SessionPublicKey };
// noinspection JSUnusedGlobalSymbols
export const ENTITIES: ReadonlyArray<new () => any> = [
  Certificate,
  IdentityPrivateKey,
  IdentityPublicKey,
  SessionPrivateKey,
  SessionPublicKey,
];
