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
    serialization: ArrayBuffer,
    subjectPrivateAddress: string,
    subjectCertificateExpiryDate: Date,
    issuerPrivateAddress: string,
  ): Promise<void> {
    const record = this.repository.create({
      expiryDate: subjectCertificateExpiryDate,
      issuerPrivateAddress,
      serialization: Buffer.from(serialization),
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
    return record ? bufferToArray(record.serialization) : null;
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
    return records.map((record) => bufferToArray(record.serialization));
  }
}
