import { PublicKeyStore, SessionPublicKeyData } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { PublicKey } from './entities/PublicKey';

export class DBPublicKeyStore extends PublicKeyStore {
  constructor(private repository: Repository<PublicKey>) {
    super();
  }

  protected async fetchKey(peerPrivateAddress: string): Promise<SessionPublicKeyData | null> {
    const publicKey = await this.repository.findOne(peerPrivateAddress);
    if (publicKey === undefined) {
      return null;
    }
    return {
      publicKeyCreationTime: publicKey.creationDate,
      publicKeyDer: publicKey.derSerialization,
      publicKeyId: publicKey.id,
    };
  }

  protected async saveKey(
    keyData: SessionPublicKeyData,
    peerPrivateAddress: string,
  ): Promise<void> {
    const publicKey = await this.repository.create({
      creationDate: keyData.publicKeyCreationTime,
      derSerialization: keyData.publicKeyDer,
      id: keyData.publicKeyId,
      peerPrivateAddress,
    });
    await this.repository.save(publicKey);
  }
}
