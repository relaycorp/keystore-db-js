import {
  Certificate,
  NodePrivateKeyData,
  PrivateKeyData,
  PrivateKeyStore,
  SubsequentSessionPrivateKeyData,
} from '@relaycorp/relaynet-core';
import bufferToArray from 'buffer-to-arraybuffer';
import { Repository } from 'typeorm';

import { PrivateKey } from './entities/PrivateKey';
import { PrivateKeyType } from './entities/PrivateKeyType';

export class DBPrivateKeyStore extends PrivateKeyStore {
  constructor(private repository: Repository<PrivateKey>) {
    super();
  }

  public async fetchNodeCertificates(): Promise<readonly Certificate[]> {
    const keys = await this.repository.find({ type: PrivateKeyType.NODE });
    const certificateDeserializationPromises = keys.map((k) =>
      Certificate.deserialize(bufferToArray(k.certificateDer!!)),
    );
    return Promise.all(certificateDeserializationPromises);
  }

  protected async fetchKey(keyId: string): Promise<PrivateKeyData | null> {
    const key = await this.repository.findOne(keyId);
    if (key === undefined) {
      return null;
    }
    if (key.type === PrivateKeyType.SESSION_SUBSEQUENT) {
      return {
        keyDer: key.derSerialization,
        recipientPublicKeyDigest: key.recipientPublicKeyDigest!!,
        type: PrivateKeyType.SESSION_SUBSEQUENT,
      };
    }
    return {
      certificateDer: key.certificateDer!!,
      keyDer: key.derSerialization,
      type: key.type as PrivateKeyType.NODE | PrivateKeyType.SESSION_INITIAL,
    };
  }

  protected async saveKey(privateKeyData: PrivateKeyData, keyId: string): Promise<void> {
    const privateKey = await this.repository.create({
      certificateDer: (privateKeyData as NodePrivateKeyData).certificateDer,
      derSerialization: privateKeyData.keyDer,
      id: keyId,
      recipientPublicKeyDigest: (privateKeyData as SubsequentSessionPrivateKeyData)
        .recipientPublicKeyDigest,
      type: privateKeyData.type as PrivateKeyType,
    });
    await this.repository.save(privateKey);
  }
}
