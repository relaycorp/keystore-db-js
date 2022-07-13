import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class SessionPrivateKey {
  @PrimaryColumn()
  public readonly id!: string;

  @Column()
  public readonly derSerialization!: Buffer;

  @CreateDateColumn()
  public readonly creationDate!: Date;

  @Column()
  public readonly privateAddress!: string;

  @Column({ type: 'varchar', nullable: true })
  public readonly peerPrivateAddress!: string | null;
}
