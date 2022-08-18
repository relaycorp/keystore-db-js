import {
  Certificate,
  CertificationPath,
  generateRSAKeyPair,
  getIdFromIdentityKey,
  issueGatewayCertificate,
} from '@relaycorp/relaynet-core';
import { addDays, addSeconds, differenceInMilliseconds, subSeconds } from 'date-fns';
import { Repository } from 'typeorm';

import { setUpTestDBDataSource } from './_test_utils';
import { DBCertificateStore } from './DBCertificateStore';
import { Certificate as CertificateEntity } from './entities/Certificate';

const getDataSource = setUpTestDBDataSource();

let certificateStore: DBCertificateStore;
let certificateRepository: Repository<CertificateEntity>;
beforeEach(() => {
  const dataSource = getDataSource();
  certificateRepository = dataSource.getRepository(CertificateEntity);
  certificateStore = new DBCertificateStore(certificateRepository);
});

let identityKeyPair: CryptoKeyPair;
let subjectPrivateAddress: string;
beforeAll(async () => {
  identityKeyPair = await generateRSAKeyPair();
  subjectPrivateAddress = await getIdFromIdentityKey(identityKeyPair.publicKey!);
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
  test('Expiry date should be saved', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);

    const certificateRecord = await certificateRepository.findOneOrFail({
      where: { subjectPrivateAddress },
    });
    expect(certificateRecord.expiryDate).toEqual(validCertificate.expiryDate);
  });

  test('Issuer addressed should be honoured', async () => {
    const issuerPrivateAddress = `not-${subjectPrivateAddress}`;
    await certificateStore.save(new CertificationPath(validCertificate, []), issuerPrivateAddress);

    const certificateRecord = await certificateRepository.findOneOrFail({
      where: { subjectPrivateAddress },
    });
    expect(certificateRecord.issuerPrivateAddress).toEqual(issuerPrivateAddress);
  });

  test('The same subject should be allowed to have multiple certificates', async () => {
    const certificate2 = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addDays(validCertificate.expiryDate, 1),
    });

    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);
    await certificateStore.save(new CertificationPath(certificate2, []), subjectPrivateAddress);

    const certificateRecords = await certificateRepository.find({
      where: { subjectPrivateAddress },
    });
    expect(certificateRecords).toHaveLength(2);
    expect(certificateRecords[0].expiryDate).toEqual(validCertificate.expiryDate);
    expect(certificateRecords[1].expiryDate).toEqual(certificate2.expiryDate);
  });
});

describe('retrieveLatestSerialization', () => {
  test('Nothing should be returned if subject has no certificates', async () => {
    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeNull();
  });

  test('Certificate from another subject should be ignored', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);

    await expect(
      certificateStore.retrieveLatest(`not-${subjectPrivateAddress}`, subjectPrivateAddress),
    ).resolves.toBeNull();
  });

  test('Certificate from another issuer should be ignored', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);

    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, `not-${subjectPrivateAddress}`),
    ).resolves.toBeNull();
  });

  test('Expired certificates should not be returned', async () => {
    await certificateStore.save(
      new CertificationPath(expiredCertificate, []),
      subjectPrivateAddress,
    );

    await expect(
      certificateStore.retrieveLatest(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeNull();
  });

  test('The latest valid certificate should be returned', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);
    const newerCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(new Date(), 60),
    });
    await certificateStore.save(new CertificationPath(newerCertificate, []), subjectPrivateAddress);

    const latestCertificate = await certificateStore.retrieveLatest(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(latestCertificate!.leafCertificate.isEqual(newerCertificate)).toBeTrue();
  });

  test('Chain should be included in returned path', async () => {
    const rootCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(new Date(), 60),
    });
    await certificateStore.save(
      new CertificationPath(validCertificate, [rootCertificate]),
      subjectPrivateAddress,
    );

    const latestPath = await certificateStore.retrieveLatest(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(latestPath!.certificateAuthorities).toHaveLength(1);
    expect(latestPath!.certificateAuthorities[0].isEqual(rootCertificate)).toBeTrue();
  });

  test('Older certificates should be ignored even if added later', async () => {
    const newestCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(validCertificate.expiryDate, 3),
    });
    await certificateStore.save(
      new CertificationPath(newestCertificate, []),
      subjectPrivateAddress,
    );
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);

    const latestPath = await certificateStore.retrieveLatest(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(latestPath!.leafCertificate.isEqual(newestCertificate)).toBeTrue();
  });
});

describe('retrieveAllSerializations', () => {
  test('Nothing should be returned if there are no certificates', async () => {
    await expect(
      certificateStore.retrieveAll(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeEmpty();
  });

  test('Expired certificates should not be returned', async () => {
    await certificateStore.save(
      new CertificationPath(expiredCertificate, []),
      subjectPrivateAddress,
    );

    await expect(
      certificateStore.retrieveAll(subjectPrivateAddress, subjectPrivateAddress),
    ).resolves.toBeEmpty();
  });

  test('Certificates from another issuer should be ignored', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);
    const differentIssuerCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: validCertificate.expiryDate,
    });
    await certificateStore.save(
      new CertificationPath(differentIssuerCertificate, []),
      `not-${subjectPrivateAddress}`,
    );

    const allCertificates = await certificateStore.retrieveAll(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(allCertificates).toHaveLength(1);
    expect(allCertificates[0].leafCertificate.isEqual(validCertificate)).toBeTrue();
  });

  test('All valid certificates should be returned', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);
    const newestCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(validCertificate.expiryDate, 3),
    });
    await certificateStore.save(
      new CertificationPath(newestCertificate, []),
      subjectPrivateAddress,
    );

    const allCertificates = await certificateStore.retrieveAll(
      subjectPrivateAddress,
      subjectPrivateAddress,
    );

    expect(allCertificates).toHaveLength(2);
    expect(
      allCertificates.filter((p) => p.leafCertificate.isEqual(validCertificate)),
    ).not.toBeEmpty();
    expect(
      allCertificates.filter((p) => p.leafCertificate.isEqual(newestCertificate)),
    ).not.toBeEmpty();
  });
});

describe('deleteExpired', () => {
  test('Expired certificates should be deleted', async () => {
    const expiringCertificate = await issueGatewayCertificate({
      issuerPrivateKey: identityKeyPair.privateKey!,
      subjectPublicKey: identityKeyPair.publicKey!,
      validityEndDate: addSeconds(new Date(), 3),
    });
    await certificateStore.save(
      new CertificationPath(expiringCertificate, []),
      subjectPrivateAddress,
    );
    await certificateStore.save(
      new CertificationPath(expiringCertificate, []),
      `not-${subjectPrivateAddress}`,
    );
    await expect(certificateRepository.count()).resolves.toEqual(2);
    await sleepUntilDate(addSeconds(expiringCertificate.expiryDate, 1));

    await certificateStore.deleteExpired();

    await expect(certificateRepository.count()).resolves.toEqual(0);
  });

  test('Valid certificates should not be deleted', async () => {
    await certificateStore.save(new CertificationPath(validCertificate, []), subjectPrivateAddress);
    await expect(certificateRepository.count()).resolves.toEqual(1);

    await certificateStore.deleteExpired();

    await expect(certificateRepository.count()).resolves.toEqual(1);
  });
});

async function sleepUntilDate(date: Date): Promise<void> {
  const deltaMs = differenceInMilliseconds(date, new Date());
  await new Promise((resolve) => setTimeout(resolve, deltaMs));
}
