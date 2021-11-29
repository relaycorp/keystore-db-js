import { PrivateKeyStore, SessionPrivateKeyData } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { PrivateKey } from './entities/PrivateKey';

export class DBPrivateKeyStore extends PrivateKeyStore {
  constructor(private repository: Repository<PrivateKey>) {
    super();
  }

  protected async saveIdentityKeySerialized(
    privateAddress: string,
    keySerialized: Buffer,
  ): Promise<void> {
    await this.saveData(`i-${privateAddress}`, keySerialized);
  }

  protected async saveSessionKeySerialized(
    keyId: string,
    keySerialized: Buffer,
    peerPrivateAddress?: string,
  ): Promise<void> {
    await this.saveData(`s-${keyId}`, keySerialized, peerPrivateAddress);
  }

  protected async retrieveIdentityKeySerialized(privateAddress: string): Promise<Buffer | null> {
    const privateKey = await this.retrieveKey(`i-${privateAddress}`);
    return privateKey?.derSerialization ?? null;
  }

  protected async retrieveSessionKeyData(keyId: string): Promise<SessionPrivateKeyData | null> {
    const privateKey = await this.retrieveKey(`s-${keyId}`);
    if (!privateKey) {
      return null;
    }
    return {
      keySerialized: privateKey.derSerialization,
      peerPrivateAddress: privateKey.peerPrivateAddress ?? undefined,
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

  private async retrieveKey(keyId: string): Promise<PrivateKey | null> {
    return (await this.repository.findOne(keyId)) ?? null;
  }
}
