import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import { PrivateKeyType } from './PrivateKeyType';

@Entity()
export class PrivateKey {
  @PrimaryColumn()
  public readonly id!: string;

  @Column()
  public readonly derSerialization!: Buffer;

  @Column({ type: 'simple-enum', enum: PrivateKeyType })
  public readonly type!: PrivateKeyType;

  @CreateDateColumn()
  public readonly creationDate!: Date;

  @Column({ type: 'blob', nullable: true })
  public readonly certificateDer!: Buffer | null;

  @Column({ type: 'varchar', nullable: true })
  public readonly peerPrivateAddress!: string | null;
}
