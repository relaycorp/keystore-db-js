import {
  CertificateScope as AwalaCertificateScope,
  CertificateStore,
} from '@relaycorp/relaynet-core';
import bufferToArray from 'buffer-to-arraybuffer';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { Certificate, CertificateScope } from './entities/Certificate';

const SQL_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss.SSS';

export class DBCertificateStore extends CertificateStore {
  constructor(private repository: Repository<Certificate>) {
    super();
  }

  public async deleteExpired(): Promise<void> {
    return Promise.resolve(undefined);
  }

  protected async saveData(
    subjectPrivateAddress: string,
    subjectCertificateSerialized: ArrayBuffer,
    subjectCertificateExpiryDate: Date,
    scope: AwalaCertificateScope,
  ): Promise<void> {
    const record = this.repository.create({
      certificateSerialized: Buffer.from(subjectCertificateSerialized),
      expiryDate: subjectCertificateExpiryDate,
      scope: convertScopeFromAwala(scope),
      subjectPrivateAddress,
    });
    await this.repository.save(record);
  }

  protected async retrieveLatestSerialization(
    subjectPrivateAddress: string,
    scope: AwalaCertificateScope,
  ): Promise<ArrayBuffer | null> {
    const whereFields = {
      expiryDate: MoreThanOrEqual(sqlDateFormat(new Date())),
      scope: convertScopeFromAwala(scope),
    };
    const record = await this.repository.findOne(
      { subjectPrivateAddress },
      {
        order: { expiryDate: 'DESC' },
        where: whereFields,
      },
    );
    return record ? bufferToArray(record.certificateSerialized) : null;
  }

  protected async retrieveAllSerializations(
    subjectPrivateAddress: string,
    scope: AwalaCertificateScope,
  ): Promise<readonly ArrayBuffer[]> {
    const records = await this.repository.find({
      expiryDate: MoreThanOrEqual(sqlDateFormat(new Date())),
      scope: convertScopeFromAwala(scope),
      subjectPrivateAddress,
    });
    return records.map((record) => bufferToArray(record.certificateSerialized));
  }
}

function sqlDateFormat(date: Date): string {
  const zonedDate = utcToZonedTime(date, 'UTC');
  return format(zonedDate, SQL_DATE_FORMAT, {
    timeZone: 'UTC',
  } as any);
}

function convertScopeFromAwala(awalaScope: AwalaCertificateScope): CertificateScope {
  return awalaScope === AwalaCertificateScope.PDA ? CertificateScope.PDA : CertificateScope.CDA;
}
