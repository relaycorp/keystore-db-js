import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// This is duplicates the namesake enum in the Awala core lib as of this writing. This is so
// any change to the enum values in the core lib won't cause runtime issues inadvertently.
export enum CertificateScope {
  PDA = 'pda',
  CDA = 'cda',
}

@Entity()
export class Certificate {
  @PrimaryGeneratedColumn()
  public readonly id!: number;

  @Index()
  @Column()
  public readonly subjectPrivateAddress!: string;

  @Column()
  public readonly certificateSerialized!: Buffer;

  @Index()
  @Column()
  public readonly expiryDate!: Date;

  @Column({
    enum: CertificateScope,
    type: 'simple-enum',
  })
  public readonly scope!: string;
}
