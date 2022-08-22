import {
  derDeserializeRSAPrivateKey,
  derSerializePrivateKey,
  PrivateKeyStore,
  SessionPrivateKeyData,
} from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { IdentityPrivateKey } from './entities/IdentityPrivateKey';
import { SessionPrivateKey } from './entities/SessionPrivateKey';

export class DBPrivateKeyStore extends PrivateKeyStore {
  constructor(
    private identityKeyRepository: Repository<IdentityPrivateKey>,
    private sessionKeyRepository: Repository<SessionPrivateKey>,
  ) {
    super();
  }

  public async retrieveIdentityKey(id: string): Promise<CryptoKey | null> {
    const keyData = await this.identityKeyRepository.findOneBy({ id });
    return keyData ? derDeserializeRSAPrivateKey(keyData.derSerialization) : null;
  }

  public async saveIdentityKey(id: string, privateKey: CryptoKey): Promise<void> {
    const privateKeySerialized = await derSerializePrivateKey(privateKey);
    const privateKeyData = await this.identityKeyRepository.create({
      derSerialization: privateKeySerialized,
      id,
    });
    await this.identityKeyRepository.save(privateKeyData);
  }

  protected async saveSessionKeySerialized(
    keyId: string,
    keySerialized: Buffer,
    nodeId: string,
    peerId?: string,
  ): Promise<void> {
    const privateKey = await this.sessionKeyRepository.create({
      derSerialization: keySerialized,
      id: keyId,
      nodeId,
      peerId,
    });
    await this.sessionKeyRepository.save(privateKey);
  }

  protected async retrieveSessionKeyData(keyId: string): Promise<SessionPrivateKeyData | null> {
    const privateKey = await this.sessionKeyRepository.findOne({ where: { id: keyId } });
    if (!privateKey) {
      return null;
    }
    return {
      keySerialized: privateKey.derSerialization,
      peerId: privateKey.peerId ?? undefined,
      nodeId: privateKey.nodeId!,
    };
  }
}
