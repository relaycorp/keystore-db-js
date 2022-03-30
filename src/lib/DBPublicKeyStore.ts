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
    peerPrivateAddress: string,
  ): Promise<void> {
    const publicKey = await this.identityKeyRepository.create({
      derSerialization: keySerialized,
      peerPrivateAddress,
    });
    await this.identityKeyRepository.save(publicKey);
  }

  protected override async retrieveIdentityKeySerialized(
    peerPrivateAddress: string,
  ): Promise<Buffer | null> {
    const publicKey = await this.identityKeyRepository.findOne({ where: { peerPrivateAddress } });
    if (publicKey) {
      return publicKey.derSerialization;
    }
    return null;
  }

  protected override async saveSessionKeyData(
    keyData: SessionPublicKeyData,
    peerPrivateAddress: string,
  ): Promise<void> {
    const publicKey = await this.sessionRepository.create({
      creationDate: keyData.publicKeyCreationTime,
      derSerialization: keyData.publicKeyDer,
      id: keyData.publicKeyId,
      peerPrivateAddress,
    });
    await this.sessionRepository.save(publicKey);
  }

  protected override async retrieveSessionKeyData(
    peerPrivateAddress: string,
  ): Promise<SessionPublicKeyData | null> {
    const publicKey = await this.sessionRepository.findOne({ where: { peerPrivateAddress } });
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
