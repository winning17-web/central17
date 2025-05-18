import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const config = {
  port: process.env.PORT || 3002,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/gaming-central-ai',
  jwtSecret: process.env.JWT_SECRET || 'referee-ai-secret',
  
  // AI model settings
  modelSettings: {
    screenshotVerification: {
      confidenceThreshold: 0.85,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp']
    },
    matchAutomation: {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 10
    }
  },
  
  // Customization settings
  customizationLevels: {
    admin: ['all'],
    moderator: ['matchRules', 'verificationSettings'],
    community: ['suggestionVoting']
  },
  
  // API endpoints for other services
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    tournamentService: process.env.TOURNAMENT_SERVICE_URL || 'http://localhost:3003'
  },
  
  // Storage paths
  storagePaths: {
    screenshots: path.join(__dirname, '../uploads/screenshots'),
    models: path.join(__dirname, '../models'),
    trainingData: path.join(__dirname, '../data/training')
  }
};

export default config;
