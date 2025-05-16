import { IsNotEmpty, IsOptional, IsString, IsEthereumAddress, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEthereumAddress()
  walletAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;
}

