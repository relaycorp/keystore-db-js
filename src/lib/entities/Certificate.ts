import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Certificate {
  @PrimaryGeneratedColumn()
  public readonly id!: number;

  @Index()
  @Column()
  public readonly subjectId!: string;

  @Index()
  @Column()
  public readonly issuerId!: string;

  @Column()
  public readonly serialization!: Buffer;

  @Index()
  @Column()
  public readonly expiryDate!: Date;
}
