import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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
}
