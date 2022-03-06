import {
  derSerializePrivateKey,
  generateRSAKeyPair,
  getPrivateAddressFromIdentityKey,
  SessionKeyPair,
  UnknownKeyError,
} from '@relaycorp/relaynet-core';
import { getConnection, Repository } from 'typeorm';

import { setUpTestDBConnection } from './_test_utils';
import { DBPrivateKeyStore } from './DBPrivateKeyStore';
import { PrivateKey } from './entities/PrivateKey';

setUpTestDBConnection();

let keystore: DBPrivateKeyStore;
let privateKeyRepository: Repository<PrivateKey>;
beforeEach(() => {
  const connection = getConnection();
  privateKeyRepository = connection.getRepository(PrivateKey);
  keystore = new DBPrivateKeyStore(privateKeyRepository);
});

let identityKeyPair: CryptoKeyPair;
let identityPrivateKey: CryptoKey;
let privateAddress: string;
beforeAll(async () => {
  identityKeyPair = await generateRSAKeyPair();
  identityPrivateKey = identityKeyPair.privateKey!;
  privateAddress = await getPrivateAddressFromIdentityKey(identityKeyPair.publicKey!);
});

let sessionKeyPair: SessionKeyPair;
let sessionKeyIdPk: string;
beforeAll(async () => {
  sessionKeyPair = await SessionKeyPair.generate();
  sessionKeyIdPk = `s-${sessionKeyPair.sessionKey.keyId.toString('hex')}`;
});

const PEER_PRIVATE_ADDRESS = '0deadbeef';

describe('Saving', () => {
  test('Identity key should have all its attributes stored', async () => {
    await keystore.saveIdentityKey(identityPrivateKey);

    const key = await privateKeyRepository.findOne(`i-${privateAddress}`);
    expect(key).toMatchObject<Partial<PrivateKey>>({
      derSerialization: await derSerializePrivateKey(identityPrivateKey),
      peerPrivateAddress: null,
    });
  });

  test('Unbound session key should have all its attributes stored', async () => {
    await keystore.saveUnboundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
    );

    const key = await privateKeyRepository.findOne(sessionKeyIdPk);

    expect(key).toMatchObject<Partial<PrivateKey>>({
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerPrivateAddress: null,
    });
  });

  test('Bound session key should have all its attributes stored', async () => {
    await keystore.saveBoundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PEER_PRIVATE_ADDRESS,
    );

    const key = await privateKeyRepository.findOne(sessionKeyIdPk);
    expect(key).toMatchObject<Partial<PrivateKey>>({
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerPrivateAddress: PEER_PRIVATE_ADDRESS,
    });
  });

  test('Key should be updated if it already exists', async () => {
    await keystore.saveUnboundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
    );
    const newPrivateKey = (await SessionKeyPair.generate()).privateKey;
    await keystore.saveUnboundSessionKey(newPrivateKey, sessionKeyPair.sessionKey.keyId);

    const key = await privateKeyRepository.findOne(sessionKeyIdPk);
    expect(key!.derSerialization).toEqual(await derSerializePrivateKey(newPrivateKey));
  });
});

describe('Retrieval', () => {
  test('Identity key should be returned', async () => {
    await keystore.saveIdentityKey(identityPrivateKey);

    const key = await keystore.retrieveIdentityKey(privateAddress);

    await expect(derSerializePrivateKey(key)).resolves.toEqual(
      await derSerializePrivateKey(identityPrivateKey),
    );
  });

  test('Unbound session key should be returned', async () => {
    await keystore.saveUnboundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
    );

    const privateKey = await keystore.retrieveUnboundSessionKey(sessionKeyPair.sessionKey.keyId);

    await expect(derSerializePrivateKey(privateKey)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Bound session key should be returned', async () => {
    await keystore.saveBoundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PEER_PRIVATE_ADDRESS,
    );

    const key = await keystore.retrieveSessionKey(
      sessionKeyPair.sessionKey.keyId,
      PEER_PRIVATE_ADDRESS,
    );

    await expect(derSerializePrivateKey(key)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Lookup should fail if key is bound to different recipient', async () => {
    await keystore.saveBoundSessionKey(
      sessionKeyPair.privateKey,
      sessionKeyPair.sessionKey.keyId,
      PEER_PRIVATE_ADDRESS,
    );

    const wrongPeerPrivateAddress = `not-${PEER_PRIVATE_ADDRESS}`;
    const sessionKeyIdHex = sessionKeyPair.sessionKey.keyId.toString('hex');
    await expect(
      keystore.retrieveSessionKey(sessionKeyPair.sessionKey.keyId, wrongPeerPrivateAddress),
    ).rejects.toEqual(
      new UnknownKeyError(
        `Session key ${sessionKeyIdHex} is bound to another recipient ` +
          `(${PEER_PRIVATE_ADDRESS}, not ${wrongPeerPrivateAddress})`,
      ),
    );
  });

  test('UnknownKeyError should be raised if identity key is missing', async () => {
    await expect(keystore.retrieveIdentityKey(privateAddress)).rejects.toBeInstanceOf(
      UnknownKeyError,
    );
  });

  test('UnknownKeyError should be raised if session key is missing', async () => {
    await expect(
      keystore.retrieveSessionKey(sessionKeyPair.sessionKey.keyId, PEER_PRIVATE_ADDRESS),
    ).rejects.toBeInstanceOf(UnknownKeyError);
  });
});
