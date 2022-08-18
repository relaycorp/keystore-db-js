import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class IdentityPrivateKey {
  @PrimaryColumn()
  public readonly id!: string;

  @Column()
  public readonly derSerialization!: Buffer;

  @CreateDateColumn()
  public readonly creationDate!: Date;
}
