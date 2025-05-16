import { Controller, Post, Body, Get, Param, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";

@Controller("users") // Changed from 'user' to 'users' for RESTful conventions
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.createUser(createUserDto);
  }

  @Get(":walletAddress")
  async getUserByWalletAddress(@Param("walletAddress") walletAddress: string): Promise<User | undefined> {
    return this.userService.findByWalletAddress(walletAddress);
  }

  // We will add more endpoints here for auth (nonce, login), profile updates etc.
}

