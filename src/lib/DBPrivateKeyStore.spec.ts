import { derSerializePrivateKey, SessionKeyPair, UnknownKeyError } from '@relaycorp/relaynet-core';
import { Repository } from 'typeorm';

import { setUpTestDBDataSource } from './_test_utils';
import { DBPrivateKeyStore } from './DBPrivateKeyStore';
import { IdentityPrivateKey } from './entities/IdentityPrivateKey';
import { SessionPrivateKey } from './entities/SessionPrivateKey';

const getDataSource = setUpTestDBDataSource();

let keystore: DBPrivateKeyStore;
let identityKeyRepository: Repository<IdentityPrivateKey>;
let sessionKeyRepository: Repository<SessionPrivateKey>;
beforeEach(() => {
  const dataSource = getDataSource();
  identityKeyRepository = dataSource.getRepository(IdentityPrivateKey);
  sessionKeyRepository = dataSource.getRepository(SessionPrivateKey);
  keystore = new DBPrivateKeyStore(identityKeyRepository, sessionKeyRepository);
});

let sessionKeyPair: SessionKeyPair;
let sessionKeyIdPk: string;
beforeAll(async () => {
  sessionKeyPair = await SessionKeyPair.generate();
  sessionKeyIdPk = sessionKeyPair.sessionKey.keyId.toString('hex');
});

const PRIVATE_ADDRESS = '0deadbeef';
const PEER_PRIVATE_ADDRESS = '0deadc0de';

describe('Saving', () => {
  test('Identity key should have all its attributes stored', async () => {
    const { id, privateKey } = await keystore.generateIdentityKeyPair();

    const key = await identityKeyRepository.findOne({
      where: { id },
    });
    expect(key).toMatchObject<Partial<IdentityPrivateKey>>({
      derSerialization: await derSerializePrivateKey(privateKey),
    });
  });

  test('Unbound session key should have all its attributes stored', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
    );

    const key = await sessionKeyRepository.findOne({ where: { id: sessionKeyIdPk } });

    expect(key).toMatchObject<Partial<SessionPrivateKey>>({
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerId: null,
    });
  });

  test('Bound session key should have all its attributes stored', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
      PEER_PRIVATE_ADDRESS,
    );

    const key = await sessionKeyRepository.findOne({ where: { id: sessionKeyIdPk } });
    expect(key).toMatchObject<Partial<SessionPrivateKey>>({
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerId: PEER_PRIVATE_ADDRESS,
    });
  });

  test('Key should be updated if it already exists', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
    );
    const newPrivateKey = (await SessionKeyPair.generate()).privateKey;
    await keystore.saveSessionKey(newPrivateKey, sessionKeyPair.sessionKey.keyId, PRIVATE_ADDRESS);

    const key = await sessionKeyRepository.findOne({ where: { id: sessionKeyIdPk } });
    expect(key!.derSerialization).toEqual(await derSerializePrivateKey(newPrivateKey));
  });
});

describe('Retrieval', () => {
  test('Identity key should be returned', async () => {
    const { id, privateKey } = await keystore.generateIdentityKeyPair();

    const key = await keystore.retrieveIdentityKey(id);

    await expect(derSerializePrivateKey(key!)).resolves.toEqual(
      await derSerializePrivateKey(privateKey),
    );
  });

  test('Unbound session key should be returned', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
    );

    const privateKey = await keystore.retrieveUnboundSessionKey(
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
    );

    await expect(derSerializePrivateKey(privateKey)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Bound session key should be returned', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
      PEER_PRIVATE_ADDRESS,
    );

    const key = await keystore.retrieveSessionKey(
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
      PEER_PRIVATE_ADDRESS,
    );

    await expect(derSerializePrivateKey(key)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Lookup should fail if key is bound to different owner', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
      PEER_PRIVATE_ADDRESS,
    );

    const wrongPrivateAddress = `not-${PRIVATE_ADDRESS}`;
    await expect(
      keystore.retrieveSessionKey(
        sessionKeyPair.sessionKey.keyId,
        wrongPrivateAddress,
        PEER_PRIVATE_ADDRESS,
      ),
    ).rejects.toEqual(new UnknownKeyError('Key is owned by a different node'));
  });

  test('Lookup should fail if key is bound to different recipient', async () => {
    await keystore.saveSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PRIVATE_ADDRESS,
      PEER_PRIVATE_ADDRESS,
    );

    const wrongPeerPrivateAddress = `not-${PEER_PRIVATE_ADDRESS}`;
    const sessionKeyIdHex = sessionKeyPair.sessionKey.keyId.toString('hex');
    await expect(
      keystore.retrieveSessionKey(
        sessionKeyPair.sessionKey.keyId,
        PRIVATE_ADDRESS,
        wrongPeerPrivateAddress,
      ),
    ).rejects.toEqual(
      new UnknownKeyError(
        `Session key ${sessionKeyIdHex} is bound to another recipient ` +
          `(${PEER_PRIVATE_ADDRESS}, not ${wrongPeerPrivateAddress})`,
      ),
    );
  });

  test('UnknownKeyError should be raised if identity key is missing', async () => {
    await expect(keystore.retrieveIdentityKey('non-existing')).resolves.toBeNull();
  });

  test('UnknownKeyError should be raised if session key is missing', async () => {
    await expect(
      keystore.retrieveSessionKey(
        sessionKeyPair.sessionKey.keyId,
        PRIVATE_ADDRESS,
        PEER_PRIVATE_ADDRESS,
      ),
    ).rejects.toBeInstanceOf(UnknownKeyError);
  });
});
