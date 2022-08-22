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
    subjectId: string,
    subjectCertificateExpiryDate: Date,
    issuerId: string,
  ): Promise<void> {
    const record = this.repository.create({
      expiryDate: subjectCertificateExpiryDate,
      issuerId,
      serialization: Buffer.from(serialization),
      subjectId,
    });
    await this.repository.save(record);
  }

  protected async retrieveLatestSerialization(
    subjectId: string,
    issuerId: string,
  ): Promise<ArrayBuffer | null> {
    const where = {
      expiryDate: MoreThanOrEqual(new Date()),
      issuerId,
      subjectId,
    };
    const record = await this.repository.findOne({
      order: { expiryDate: 'DESC' },
      where,
    });
    return record ? bufferToArray(record.serialization) : null;
  }

  protected async retrieveAllSerializations(
    subjectId: string,
    issuerId: string,
  ): Promise<readonly ArrayBuffer[]> {
    const records = await this.repository.find({
      where: {
        expiryDate: MoreThanOrEqual(new Date()),
        issuerId,
        subjectId,
      },
    });
    return records.map((record) => bufferToArray(record.serialization));
  }
}
