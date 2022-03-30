import { CertificateStore } from '@relaycorp/relaynet-core';
import bufferToArray from 'buffer-to-arraybuffer';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Certificate } from './entities/Certificate';

export class DBCertificateStore extends CertificateStore {
  constructor(private repository: Repository<Certificate>) {
    super();
  }

  public async deleteExpired(): Promise<void> {
    await this.repository.delete({
      expiryDate: LessThanOrEqual(new Date()),
    });
  }

  protected async saveData(
    subjectPrivateAddress: string,
    subjectCertificateSerialized: ArrayBuffer,
    subjectCertificateExpiryDate: Date,
    issuerPrivateAddress: string,
  ): Promise<void> {
    const record = this.repository.create({
      certificateSerialized: Buffer.from(subjectCertificateSerialized),
      expiryDate: subjectCertificateExpiryDate,
      issuerPrivateAddress,
      subjectPrivateAddress,
    });
    await this.repository.save(record);
  }

  protected async retrieveLatestSerialization(
    subjectPrivateAddress: string,
    issuerPrivateAddress: string,
  ): Promise<ArrayBuffer | null> {
    const where = {
      expiryDate: MoreThanOrEqual(new Date()),
      issuerPrivateAddress,
      subjectPrivateAddress,
    };
    const record = await this.repository.findOne({
      order: { expiryDate: 'DESC' },
      where,
    });
    return record ? bufferToArray(record.certificateSerialized) : null;
  }

  protected async retrieveAllSerializations(
    subjectPrivateAddress: string,
    issuerPrivateAddress: string,
  ): Promise<readonly ArrayBuffer[]> {
    const records = await this.repository.find({
      where: {
        expiryDate: MoreThanOrEqual(new Date()),
        issuerPrivateAddress,
        subjectPrivateAddress,
      },
    });
    return records.map((record) => bufferToArray(record.certificateSerialized));
  }
}
