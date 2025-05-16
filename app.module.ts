import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/user.entity'; // Make sure this path is correct

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost', // Use environment variables
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password', // Replace with your actual password or env var
      database: process.env.DB_NAME || 'gaming_central_db',
      entities: [User], // Add your entities here
      synchronize: true, // DEV only: auto-creates schema. Disable in prod.
      autoLoadEntities: true, // Recommended to automatically load entities
    }),
    // If you create a UserModule, import it here later
    // UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

