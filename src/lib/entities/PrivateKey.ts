import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class PrivateKey {
  @PrimaryColumn()
  public readonly id!: string;

  @Column()
  public readonly derSerialization!: Buffer;

  @CreateDateColumn()
  public readonly creationDate!: Date;

  @Column({ type: 'varchar', nullable: true })
  public readonly peerPrivateAddress!: string | null;
}
