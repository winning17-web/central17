import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import config from './config';

// Import routes
import screenshotRoutes from './routes/screenshotRoutes';
import matchRoutes from './routes/matchRoutes';
import customizationRoutes from './routes/customizationRoutes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create upload directories if they don't exist
if (!fs.existsSync(config.storagePaths.screenshots)) {
  fs.mkdirSync(config.storagePaths.screenshots, { recursive: true });
}

if (!fs.existsSync(config.storagePaths.models)) {
  fs.mkdirSync(config.storagePaths.models, { recursive: true });
}

if (!fs.existsSync(config.storagePaths.trainingData)) {
  fs.mkdirSync(config.storagePaths.trainingData, { recursive: true });
}

// Routes
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/customization', customizationRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-service', name: 'The Referee' });
});

// Connect to MongoDB
mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    const PORT = config.port;
    app.listen(PORT, () => {
      console.log(`AI Service "The Referee" running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
