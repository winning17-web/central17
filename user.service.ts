import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";
import { CreateUserDto } from "./dto/create-user.dto"; // We will create this DTO

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { walletAddress, username } = createUserDto;
    // Basic check for existing user by walletAddress
    const existingUser = await this.usersRepository.findOne({ where: { walletAddress } });
    if (existingUser) {
      // Handle appropriately, e.g., throw an error or return existing user
      // For now, let's assume we might update or just return it
      // Or throw new ConflictException('User with this wallet address already exists');
      return existingUser; // Or update logic
    }

    const user = this.usersRepository.create({ walletAddress, username });
    return this.usersRepository.save(user);
  }

  async findByWalletAddress(walletAddress: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { walletAddress } });
  }

  // We will add more methods here for nonce generation, signature verification, profile updates etc.
}

