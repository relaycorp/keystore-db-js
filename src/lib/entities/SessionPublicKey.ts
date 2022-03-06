import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class SessionPublicKey {
  @PrimaryColumn()
  public readonly peerPrivateAddress!: string;

  @Column()
  public readonly id!: Buffer;

  @Column()
  public readonly derSerialization!: Buffer;

  @Column()
  public readonly creationDate!: Date;
}
