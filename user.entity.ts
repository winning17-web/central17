import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  walletAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  @Index({ unique: true, where: '"username" IS NOT NULL' })
  username?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profileImageUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nonce?: string; // For signature-based login

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

