import {
  Certificate,
  generateRSAKeyPair,
  getPrivateAddressFromIdentityKey,
  issueGatewayCertificate,
} from '@relaycorp/relaynet-core';
import { addDays, addSeconds, subSeconds } from 'date-fns';
import { getConnection, Repository } from 'typeorm';

import { setUpTestDBConnection } from './_test_utils';
import { DBCertificateStore } from './DBCertificateStore';
import { Certificate as CertificateEntity } from './entities/Certificate';

setUpTestDBConnection();

let certificateStore: DBCertificateStore;
let certificateRepository: Repository<CertificateEntity>;
beforeEach(() => {
  const connection = getConnection();
  certificateRepository = connection.getRepository(CertificateEntity);
  certificateStore = new DBCertificateStore(certificateRepository);
});

let identityKeyPair: CryptoKeyPair;
let subjectPrivateAddress: string;
beforeAll(async () => {
  identityKeyPair = await generateRSAKeyPair();
  subjectPrivateAddress = await getPrivateAddressFromIdentityKey(identityKeyPair.publicKey!);
});

let validCertificate: Certificate;
let expiredCertificate: Certificate;
beforeEach(async () => {
  // These tests are sensitive to the validity period of the certificates so, since GitHub Actions
  // are so slow, we should generate these certificates right before each test.
  validCertificate = await issueGatewayCertificate({
    issuerPrivateKey: identityKeyPair.privateKey!,
    subjectPublicKey: identityKeyPair.publicKey!,
    validityEndDate: addSeconds(
      new Date(),
      10, // Be generous -- GitHub Actions are extremely slow.
    ),
  });
  expiredCertificate = await issueGatewayCertificate({
    issuerPrivateKey: identityKeyPair.privateKey!,
    subjectPublicKey: identityKeyPair.publicKey!,
    validityEndDate: subSeconds(new Date(), 1),
    validityStartDate: subSeconds(new Date(), 2),
  });
});

describe('saveData', () => {
  test('Certificate attributes should be saved', async () => {
    await certificateStore.save(validCertificate, subjectPrivateAddress);

    const certificateRecord = await certificateRepository.findOneOrFail({ subjectPrivateAddress });
    expect(certificateRecord).toMatchObject<Partial<CertificateEntity>>({
      certificateSerialized: Buffer.from(validCertificate.serialize()),
      expiryDate: validCertificate.expiryDate,
    });
  });

  test('Issuer addressed should be honoured', async () => {
    const issuerPrivateAddress = `not-${subjectPrivateAddress}`;
    await certificateStore.save(validCertificate, issuerPrivateAddress);

    const certificateRecord = await certificateRepository.findOneOrFail({ subjectPrivateAddress });
    expect(certificateRecord.issuerPrivateAddress).toEqual(issuerPrivateAddress);
  });

  test('The same subject should be allowed to have multiple certificates', async () => {
    const certificate2 = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addDays(validCertificate.expiryDate, 1),
    });

    await certificateStore.save(validCertificate, subjectPrivateAddress);
    await certificateStore.save(certificate2, subjectPrivateAddress);

    const certificateRecords = await certificateRepository.find({ subjectPrivateAddress });
    expect(certificateRecords).toHaveLength(2);
    expect(certificateRecords[0]).toMatchObject<Partial<CertificateEntity>>({
      certificateSerialized: Buffer.from(validCertificate.serialize()),
      expiryDate: validCertificate.expiryDate,
    });
    expect(certificateRecords[1]).toMatchObject<Partial<CertificateEntity>>({
      certificateSerialized: Buffer.from(certificate2.serialize()),
      expiryDate: certificate2.expiryDate,
    });
  });
});

describe('retrieveLatestSerialization', () => {
  test('Nothing should be returned if subject has no certificates', async () => {
    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeNull();
  });

  test('Certificate from another issuer should be ignored', async () => {
    await certificateStore.save(expiredCertificate, subjectPrivateAddress);

    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, `not-${subjectPrivateAddress}`),
    ).resolves.toBeNull();
  });

  test('Expired certificates should not be returned', async () => {
    await certificateStore.save(expiredCertificate, subjectPrivateAddress);

    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeNull();
  });

  test('The latest valid certificate should be returned', async () => {
    await certificateStore.save(validCertificate, subjectPrivateAddress);
    const newerCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(new Date(), 60),
    });
    await certificateStore.save(newerCertificate, subjectPrivateAddress);

    const latestCertificate = await certificateStore.retrieveLatest(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(latestCertificate!.isEqual(newerCertificate)).toBeTrue();
  });

  test('Older certificates should be ignored even if added later', async () => {
    const newestCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(validCertificate.expiryDate, 3),
    });
    await certificateStore.save(newestCertificate, subjectPrivateAddress);
    await certificateStore.save(validCertificate, subjectPrivateAddress);

    const latestCertificate = await certificateStore.retrieveLatest(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(latestCertificate!.isEqual(newestCertificate)).toBeTrue();
  });
});

describe('retrieveAllSerializations', () => {
  test('Nothing should be returned if there are no certificates', async () => {
    await expect(
      certificateStore.retrieveAll(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeEmpty();
  });

  test('Expired certificates should not be returned', async () => {
    await certificateStore.save(expiredCertificate, subjectPrivateAddress);

    await expect(
      certificateStore.retrieveAll(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeEmpty();
  });

  test('Certificates from another issuer should be ignored', async () => {
    await certificateStore.save(validCertificate, subjectPrivateAddress);
    const differentIssuerCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: validCertificate.expiryDate,
    });
    await certificateStore.save(differentIssuerCertificate, `not-${subjectPrivateAddress}`);

    const allCertificates = await certificateStore.retrieveAll(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(allCertificates).toHaveLength(1);
    expect(allCertificates[0].isEqual(validCertificate)).toBeTrue();
  });

  test('All valid certificates should be returned', async () => {
    await certificateStore.save(validCertificate, subjectPrivateAddress);
    const newestCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(validCertificate.expiryDate, 3),
    });
    await certificateStore.save(newestCertificate, subjectPrivateAddress);

    const allCertificates = await certificateStore.retrieveAll(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(allCertificates).toHaveLength(2);
    expect(allCertificates.filter((c) => c.isEqual(validCertificate))).not.toBeEmpty();
    expect(allCertificates.filter((c) => c.isEqual(newestCertificate))).not.toBeEmpty();
  });
});

describe('deleteExpired', () => {
  test('Expired certificates should be deleted', async () => {
    await certificateStore.save(expiredCertificate, subjectPrivateAddress);
    await certificateStore.save(expiredCertificate, `not-${subjectPrivateAddress}`);

    await certificateStore.deleteExpired();

    await expect(certificateRepository.count()).resolves.toEqual(0);
  });

  test('Valid certificates should not be deleted', async () => {
    await certificateStore.save(validCertificate, subjectPrivateAddress);

    await certificateStore.deleteExpired();

    await expect(certificateRepository.count()).resolves.toEqual(1);
  });
});
