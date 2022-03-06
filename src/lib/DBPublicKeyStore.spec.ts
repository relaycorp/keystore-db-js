import { derSerializePublicKey, SessionKey, SessionKeyPair } from '@relaycorp/relaynet-core';
import { getConnection, Repository } from 'typeorm';

import { setUpTestDBConnection } from './_test_utils';
import { DBPublicKeyStore } from './DBPublicKeyStore';
import { SessionPublicKey } from './entities/SessionPublicKey';

setUpTestDBConnection();

let keystore: DBPublicKeyStore;
let publicKeyRepository: Repository<SessionPublicKey>;
beforeEach(() => {
  const connection = getConnection();
  publicKeyRepository = connection.getRepository(SessionPublicKey);
  keystore = new DBPublicKeyStore(publicKeyRepository);
});

describe('Session keys', () => {
  const peerPrivateAddress = '0deadbeef';
  let peerSessionKey: SessionKey;
  beforeAll(async () => {
    const { sessionKey } = await SessionKeyPair.generate();
    peerSessionKey = sessionKey;
  });

  describe('fetchKey', () => {
    test('Existing key should be returned', async () => {
      await keystore.saveSessionKey(peerSessionKey, peerPrivateAddress, new Date());

      const key = await keystore.retrieveLastSessionKey(peerPrivateAddress);

      expect(key?.keyId).toEqual(peerSessionKey.keyId);
      await expect(derSerializePublicKey(key!.publicKey)).resolves.toEqual(
        await derSerializePublicKey(peerSessionKey.publicKey),
      );
    });

    test('Non-existing key should result in null', async () => {
      await expect(keystore.retrieveLastSessionKey(peerPrivateAddress)).resolves.toBeNull();
    });
  });

  describe('saveKey', () => {
    test('Key should be created if it does not exist', async () => {
      const creationDate = new Date();

      await keystore.saveSessionKey(peerSessionKey, peerPrivateAddress, creationDate);

      const key = await publicKeyRepository.findOne(peerPrivateAddress);
      expect(key?.creationDate).toEqual(creationDate);
      expect(key?.id).toEqual(peerSessionKey.keyId);
      expect(key?.derSerialization).toEqual(await derSerializePublicKey(peerSessionKey.publicKey));
    });

    test('Key should be updated if it already exists', async () => {
      const oldCreationDate = new Date();
      oldCreationDate.setHours(oldCreationDate.getHours() - 1);
      const newCreationDate = new Date();

      await keystore.saveSessionKey(peerSessionKey, peerPrivateAddress, oldCreationDate);
      await keystore.saveSessionKey(peerSessionKey, peerPrivateAddress, newCreationDate);

      const key = await publicKeyRepository.findOne(peerPrivateAddress);
      expect(key?.creationDate).toEqual(newCreationDate);
    });
  });
});
