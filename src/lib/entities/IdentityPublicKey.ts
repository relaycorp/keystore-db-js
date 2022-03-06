import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class IdentityPublicKey {
  @PrimaryColumn()
  public readonly peerPrivateAddress!: string;

  @Column()
  public readonly derSerialization!: Buffer;
}
