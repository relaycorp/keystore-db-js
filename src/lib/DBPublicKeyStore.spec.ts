import {
  derSerializePublicKey,
  generateRSAKeyPair,
  getIdFromIdentityKey,
  SessionKey,
  SessionKeyPair,
} from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { setUpTestDBDataSource } from './_test_utils';
import { DBPublicKeyStore } from './DBPublicKeyStore';
import { IdentityPublicKey } from './entities/IdentityPublicKey';
import { SessionPublicKey } from './entities/SessionPublicKey';

const getDataSource = setUpTestDBDataSource();

let keystore: DBPublicKeyStore;
let identityKeyRepository: Repository<IdentityPublicKey>;
let sessionKeyRepository: Repository<SessionPublicKey>;
beforeEach(() => {
  const dataSource = getDataSource();
  identityKeyRepository = dataSource.getRepository(IdentityPublicKey);
  sessionKeyRepository = dataSource.getRepository(SessionPublicKey);
  keystore = new DBPublicKeyStore(identityKeyRepository, sessionKeyRepository);
});

describe('Identity keys', () => {
  let peerIdentityPublicKey: CryptoKey;
  let peerId: string;
  beforeAll(async () => {
    const peerKeyPair = await generateRSAKeyPair();
    peerIdentityPublicKey = peerKeyPair.publicKey!;
    peerId = await getIdFromIdentityKey(peerIdentityPublicKey);
  });

  describe('Save', () => {
    test('Key should be created if it does not exist', async () => {
      await keystore.saveIdentityKey(peerIdentityPublicKey);

      const key = await identityKeyRepository.findOne({ where: { peerId } });
      expect(key?.derSerialization).toEqual(await derSerializePublicKey(peerIdentityPublicKey));
    });

    test('Key should be updated if it already exists', async () => {
      await keystore.saveIdentityKey(peerIdentityPublicKey);
      await keystore.saveIdentityKey(peerIdentityPublicKey);

      await expect(identityKeyRepository.count({ where: { peerId } })).resolves.toEqual(1);
    });
  });

  describe('Retrieve', () => {
    test('Null should be returned if key does not exist', async () => {
      await expect(keystore.retrieveIdentityKey(peerId)).resolves.toBeNull();
    });

    test('Existing key should be returned', async () => {
      await keystore.saveIdentityKey(peerIdentityPublicKey);

      const key = await keystore.retrieveIdentityKey(peerId);

      await expect(derSerializePublicKey(key!)).resolves.toEqual(
        await derSerializePublicKey(peerIdentityPublicKey),
      );
    });
  });
});

describe('Session keys', () => {
  const peerId = '0deadbeef';
  let peerSessionKey: SessionKey;
  beforeAll(async () => {
    const { sessionKey } = await SessionKeyPair.generate();
    peerSessionKey = sessionKey;
  });

  describe('Save', () => {
    test('Key should be created if it does not exist', async () => {
      const creationDate = new Date();

      await keystore.saveSessionKey(peerSessionKey, peerId, creationDate);

      const key = await sessionKeyRepository.findOne({ where: { peerId } });
      expect(key?.creationDate).toEqual(creationDate);
      expect(key?.id).toEqual(peerSessionKey.keyId);
      expect(key?.derSerialization).toEqual(await derSerializePublicKey(peerSessionKey.publicKey));
    });

    test('Key should be updated if it already exists', async () => {
      const oldCreationDate = new Date();
      oldCreationDate.setHours(oldCreationDate.getHours() - 1);
      const newCreationDate = new Date();

      await keystore.saveSessionKey(peerSessionKey, peerId, oldCreationDate);
      await keystore.saveSessionKey(peerSessionKey, peerId, newCreationDate);

      const key = await sessionKeyRepository.findOne({ where: { peerId } });
      expect(key?.creationDate).toEqual(newCreationDate);
    });
  });

  describe('Retrieve', () => {
    test('Existing key should be returned', async () => {
      await keystore.saveSessionKey(peerSessionKey, peerId, new Date());

      const key = await keystore.retrieveLastSessionKey(peerId);

      expect(key?.keyId).toEqual(peerSessionKey.keyId);
      await expect(derSerializePublicKey(key!.publicKey)).resolves.toEqual(
        await derSerializePublicKey(peerSessionKey.publicKey),
      );
    });

    test('Non-existing key should result in null', async () => {
      await expect(keystore.retrieveLastSessionKey(peerId)).resolves.toBeNull();
    });
  });
});
