import { PrivateKeyStore, SessionPrivateKeyData } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { PrivateKey } from './entities/PrivateKey';

export class DBPrivateKeyStore extends PrivateKeyStore {
  constructor(private repository: Repository<PrivateKey>) {
    super();
  }

  public async retrieveIdentityKey(_privateAddress: string): Promise<CryptoKey | null> {
    throw new Error('Method not implemented.');
  }

  protected saveIdentityKey(_privateAddress: string, _privateKey: CryptoKey): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected async saveSessionKeySerialized(
    keyId: string,
    keySerialized: Buffer,
    peerPrivateAddress?: string,
  ): Promise<void> {
    await this.saveData(`s-${keyId}`, keySerialized, peerPrivateAddress);
  }

  protected async retrieveSessionKeyData(keyId: string): Promise<SessionPrivateKeyData | null> {
    const privateKey = await this.retrieveKey(`s-${keyId}`);
    if (!privateKey) {
      return null;
    }
    return {
      keySerialized: privateKey.derSerialization,
      peerPrivateAddress: privateKey.peerPrivateAddress ?? undefined,
      privateAddress: 'REPLACE ME',
    };
  }

  private async saveData(
    keyId: string,
    keySerialized: Buffer,
    peerPrivateAddress?: string,
  ): Promise<void> {
    const privateKey = await this.repository.create({
      derSerialization: keySerialized,
      id: keyId,
      peerPrivateAddress,
    });
    await this.repository.save(privateKey);
  }

  private async retrieveKey(id: string): Promise<PrivateKey | null> {
    return (await this.repository.findOne({ where: { id } })) ?? null;
  }
}
