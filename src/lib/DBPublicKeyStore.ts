import { PublicKeyStore, SessionPublicKeyData } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { SessionPublicKey } from './entities/SessionPublicKey';

export class DBPublicKeyStore extends PublicKeyStore {
  constructor(private sessionRepository: Repository<SessionPublicKey>) {
    super();
  }

  protected async saveIdentityKeySerialized(
    keySerialized: Buffer,
    peerPrivateAddress: string,
  ): Promise<void> {
    throw new Error('Method not implemented.' + keySerialized + peerPrivateAddress);
  }

  protected async retrieveIdentityKeySerialized(
    peerPrivateAddress: string,
  ): Promise<Buffer | null> {
    throw new Error('Method not implemented.' + peerPrivateAddress);
  }

  protected async saveSessionKeyData(
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

  protected async retrieveSessionKeyData(
    peerPrivateAddress: string,
  ): Promise<SessionPublicKeyData | null> {
    const publicKey = await this.sessionRepository.findOne(peerPrivateAddress);
    if (publicKey === undefined) {
      return null;
    }
    return {
      publicKeyCreationTime: publicKey.creationDate,
      publicKeyDer: publicKey.derSerialization,
      publicKeyId: publicKey.id,
    };
  }
}
