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
  public readonly nodeId!: string;

  @Column({ type: 'varchar', nullable: true })
  public readonly peerId!: string | null;
}
