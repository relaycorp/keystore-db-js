import {
  Certificate,
  derSerializePrivateKey,
  generateECDHKeyPair,
  UnknownKeyError,
} from '@relaycorp/relaynet-core';
import {
  generateIdentityKeyPairSet,
  generatePDACertificationPath,
} from '@relaycorp/relaynet-testing';
import { getConnection, Repository } from 'typeorm';

import { setUpTestDBConnection } from './_test_utils';
import { DBPrivateKeyStore } from './DBPrivateKeyStore';
import { PrivateKey } from './entities/PrivateKey';
import { PrivateKeyType } from './entities/PrivateKeyType';

setUpTestDBConnection();

let keystore: DBPrivateKeyStore;
let privateKeyRepository: Repository<PrivateKey>;
beforeEach(() => {
  const connection = getConnection();
  privateKeyRepository = connection.getRepository(PrivateKey);
  keystore = new DBPrivateKeyStore(privateKeyRepository);
});

let nodeKeyPair: CryptoKeyPair;
let nodeCertificate: Certificate;
let sessionKeyPair: CryptoKeyPair;
let recipientNodeCertificate: Certificate;
beforeAll(async () => {
  const pairSet = await generateIdentityKeyPairSet();
  const certPath = await generatePDACertificationPath(pairSet);

  nodeKeyPair = pairSet.privateGateway;
  nodeCertificate = certPath.privateGateway;

  sessionKeyPair = await generateECDHKeyPair();

  recipientNodeCertificate = certPath.publicGateway;
});

const INITIAL_SESSION_KEY_ID = Buffer.from('initial session key id');
const SUBSEQUENT_SUBSEQUENT_KEY_ID = Buffer.from('subsequent key id');
const SUBSEQUENT_SUBSEQUENT_KEY_ID_HEX = SUBSEQUENT_SUBSEQUENT_KEY_ID.toString('hex');

describe('fetchKey', () => {
  test('Node key should be returned', async () => {
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);

    const key = await keystore.fetchNodeKey(nodeCertificate.getSerialNumber());

    await expect(derSerializePrivateKey(key.privateKey)).resolves.toEqual(
      await derSerializePrivateKey(nodeKeyPair.privateKey),
    );
    await expect(key.certificate.isEqual(nodeCertificate)).toBeTruthy();
  });

  test('Initial session key should be returned', async () => {
    await keystore.saveInitialSessionKey(sessionKeyPair.privateKey, INITIAL_SESSION_KEY_ID);

    const privateKey = await keystore.fetchInitialSessionKey(INITIAL_SESSION_KEY_ID);

    await expect(derSerializePrivateKey(privateKey)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Subsequent session key should be returned', async () => {
    await keystore.saveSubsequentSessionKey(
      sessionKeyPair.privateKey,
      SUBSEQUENT_SUBSEQUENT_KEY_ID,
      await recipientNodeCertificate.calculateSubjectPrivateAddress(),
    );

    const key = await keystore.fetchSessionKey(
      SUBSEQUENT_SUBSEQUENT_KEY_ID,
      await recipientNodeCertificate.calculateSubjectPrivateAddress(),
    );

    await expect(derSerializePrivateKey(key)).resolves.toEqual(
      await derSerializePrivateKey(sessionKeyPair.privateKey),
    );
  });

  test('Lookup should fail if key is bound to different recipient', async () => {
    const peerPrivateAddress = await recipientNodeCertificate.calculateSubjectPrivateAddress();
    await keystore.saveSubsequentSessionKey(
      sessionKeyPair.privateKey,
      SUBSEQUENT_SUBSEQUENT_KEY_ID,
      peerPrivateAddress,
    );

    const wrongPeerPrivateAddress = await nodeCertificate.calculateSubjectPrivateAddress();
    await expect(
      keystore.fetchSessionKey(SUBSEQUENT_SUBSEQUENT_KEY_ID, wrongPeerPrivateAddress),
    ).rejects.toEqual(
      new UnknownKeyError(
        `Session key ${SUBSEQUENT_SUBSEQUENT_KEY_ID_HEX} is bound to another recipient ` +
          `(${peerPrivateAddress}, not ${wrongPeerPrivateAddress})`,
      ),
    );
  });

  test('UnknownKeyError should be raised if record is missing', async () => {
    await expect(keystore.fetchNodeKey(Buffer.from('missing'))).rejects.toBeInstanceOf(
      UnknownKeyError,
    );
  });
});

describe('saveKey', () => {
  test('Node key should have all its attributes stored', async () => {
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);

    const key = await privateKeyRepository.findOne(nodeCertificate.getSerialNumberHex());
    expect(key).toMatchObject<Partial<PrivateKey>>({
      certificateDer: Buffer.from(nodeCertificate.serialize()),
      derSerialization: await derSerializePrivateKey(nodeKeyPair.privateKey),
      peerPrivateAddress: null,
      type: PrivateKeyType.NODE,
    });
  });

  test('Initial session key should have all its attributes stored', async () => {
    await keystore.saveInitialSessionKey(sessionKeyPair.privateKey, INITIAL_SESSION_KEY_ID);

    const key = await privateKeyRepository.findOne(INITIAL_SESSION_KEY_ID.toString('hex'));

    expect(key).toMatchObject<Partial<PrivateKey>>({
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerPrivateAddress: null,
      type: PrivateKeyType.SESSION_INITIAL,
    });
  });

  test('Subsequent session key should have all its attributes stored', async () => {
    await keystore.saveSubsequentSessionKey(
      sessionKeyPair.privateKey,
      SUBSEQUENT_SUBSEQUENT_KEY_ID,
      await recipientNodeCertificate.calculateSubjectPrivateAddress(),
    );

    const key = await privateKeyRepository.findOne(SUBSEQUENT_SUBSEQUENT_KEY_ID_HEX);
    expect(key).toMatchObject<Partial<PrivateKey>>({
      certificateDer: null,
      derSerialization: await derSerializePrivateKey(sessionKeyPair.privateKey),
      peerPrivateAddress: await recipientNodeCertificate.calculateSubjectPrivateAddress(),
      type: PrivateKeyType.SESSION_SUBSEQUENT,
    });
  });

  test('Key should be updated if it already exists', async () => {
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);
    const newPrivateKey = sessionKeyPair.privateKey;
    await keystore.saveNodeKey(newPrivateKey, nodeCertificate);

    const key = await privateKeyRepository.findOne(nodeCertificate.getSerialNumberHex());
    expect(key!.derSerialization).toEqual(await derSerializePrivateKey(newPrivateKey));
  });
});

describe('fetchNodeCertificates', () => {
  test('Nothing should be output if there are no node keys', async () => {
    const certificates = await keystore.fetchNodeCertificates();

    expect(certificates).toHaveLength(0);
  });

  test('Node certificates should be output if there are node keys', async () => {
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);

    const certificates = await keystore.fetchNodeCertificates();

    expect(certificates).toHaveLength(1);
    expect(nodeCertificate.isEqual(certificates[0])).toBeTrue();
  });

  test('Certificates for initial session keys should be ignored', async () => {
    await keystore.saveInitialSessionKey(sessionKeyPair.privateKey, INITIAL_SESSION_KEY_ID);
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);

    const certificates = await keystore.fetchNodeCertificates();

    expect(certificates).toHaveLength(1);
    expect(nodeCertificate.isEqual(certificates[0])).toBeTrue();
  });

  test('Certificates for subsequent session keys should be ignored', async () => {
    await keystore.saveSubsequentSessionKey(
      sessionKeyPair.privateKey,
      SUBSEQUENT_SUBSEQUENT_KEY_ID,
      await recipientNodeCertificate.calculateSubjectPrivateAddress(),
    );
    await keystore.saveNodeKey(nodeKeyPair.privateKey, nodeCertificate);

    const certificates = await keystore.fetchNodeCertificates();

    expect(certificates).toHaveLength(1);
    expect(nodeCertificate.isEqual(certificates[0])).toBeTrue();
  });
});
