import { PublicKeyStore, SessionPublicKeyData } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { IdentityPublicKey } from './entities/IdentityPublicKey';
import { SessionPublicKey } from './entities/SessionPublicKey';

export class DBPublicKeyStore extends PublicKeyStore {
  constructor(
    private identityKeyRepository: Repository<IdentityPublicKey>,
    private sessionRepository: Repository<SessionPublicKey>,
  ) {
    super();
  }

  protected override async saveIdentityKeySerialized(
    keySerialized: Buffer,
    peerId: string,
  ): Promise<void> {
    const publicKey = await this.identityKeyRepository.create({
      derSerialization: keySerialized,
      peerId,
    });
    await this.identityKeyRepository.save(publicKey);
  }

  protected override async retrieveIdentityKeySerialized(peerId: string): Promise<Buffer | null> {
    const publicKey = await this.identityKeyRepository.findOne({ where: { peerId } });
    if (publicKey) {
      return publicKey.derSerialization;
    }
    return null;
  }

  protected override async saveSessionKeyData(
    keyData: SessionPublicKeyData,
    peerId: string,
  ): Promise<void> {
    const publicKey = await this.sessionRepository.create({
      creationDate: keyData.publicKeyCreationTime,
      derSerialization: keyData.publicKeyDer,
      id: keyData.publicKeyId,
      peerId,
    });
    await this.sessionRepository.save(publicKey);
  }

  protected override async retrieveSessionKeyData(
    peerId: string,
  ): Promise<SessionPublicKeyData | null> {
    const publicKey = await this.sessionRepository.findOne({ where: { peerId } });
    if (publicKey) {
      return {
        publicKeyCreationTime: publicKey.creationDate,
        publicKeyDer: publicKey.derSerialization,
        publicKeyId: publicKey.id,
      };
    }
    return null;
  }
}
