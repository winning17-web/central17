import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import config from '../config';

/**
 * Service for handling match automation using TensorFlow.js
 */
class MatchAutomationService {
  private model: tf.LayersModel | null = null;
  private modelPath: string;
  private isModelLoaded: boolean = false;
  
  constructor() {
    this.modelPath = path.join(config.storagePaths.models, 'match-automation');
  }
  
  /**
   * Load the TensorFlow model for match automation
   */
  async loadModel(): Promise<boolean> {
    try {
      // Check if model directory exists
      if (!fs.existsSync(this.modelPath)) {
        console.log('Model directory does not exist, creating...');
        fs.mkdirSync(this.modelPath, { recursive: true });
        
        // Initialize a new model if none exists
        await this.initializeNewModel();
      } else {
        // Load existing model
        try {
          this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
          console.log('Loaded existing match automation model');
        } catch (error) {
          console.error('Error loading model, initializing new one:', error);
          await this.initializeNewModel();
        }
      }
      
      this.isModelLoaded = true;
      return true;
    } catch (error) {
      console.error('Failed to load match automation model:', error);
      return false;
    }
  }
  
  /**
   * Initialize a new model for match automation
   */
  private async initializeNewModel(): Promise<void> {
    // Create a simple neural network for match automation
    const model = tf.sequential();
    
    // Add layers to the model
    model.add(tf.layers.dense({
      inputShape: [10], // Input features like team size, game type, etc.
      units: 16,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 3, // Output: [match duration, expected score difference, verification confidence]
      activation: 'linear'
    }));
    
    // Compile the model
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mse']
    });
    
    this.model = model;
    
    // Save the model
    await this.model.save(`file://${this.modelPath}`);
    console.log('Initialized and saved new match automation model');
  }
  
  /**
   * Predict match parameters based on input features
   */
  async predictMatchParameters(features: {
    gameType: string;
    teamSize: number;
    playerSkillLevels: number[];
    previousMatchesCount: number;
    timeOfDay: number; // Hour in 24-hour format
  }): Promise<{
    expectedDuration: number; // in minutes
    expectedScoreDifference: number;
    verificationConfidence: number; // 0-1
  }> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }
    
    try {
      // Convert features to tensor
      // In a real implementation, this would include proper feature engineering
      const featureTensor = tf.tensor2d([
        [
          features.teamSize,
          this.gameTypeToNumeric(features.gameType),
          Math.max(...features.playerSkillLevels),
          Math.min(...features.playerSkillLevels),
          features.playerSkillLevels.reduce((a, b) => a + b, 0) / features.playerSkillLevels.length,
          features.previousMatchesCount,
          features.timeOfDay,
          features.timeOfDay < 12 ? 1 : 0, // Morning flag
          features.timeOfDay >= 12 && features.timeOfDay < 18 ? 1 : 0, // Afternoon flag
          features.timeOfDay >= 18 ? 1 : 0 // Evening flag
        ]
      ]);
      
      // Make prediction
      const prediction = this.model!.predict(featureTensor) as tf.Tensor;
      const values = await prediction.data();
      
      // Clean up tensors
      featureTensor.dispose();
      prediction.dispose();
      
      return {
        expectedDuration: Math.max(10, values[0]), // Minimum 10 minutes
        expectedScoreDifference: values[1],
        verificationConfidence: Math.min(1, Math.max(0, values[2])) // Clamp between 0-1
      };
    } catch (error) {
      console.error('Error predicting match parameters:', error);
      
      // Return default values if prediction fails
      return {
        expectedDuration: 30, // Default 30 minutes
        expectedScoreDifference: 5,
        verificationConfidence: 0.7
      };
    }
  }
  
  /**
   * Convert game type to numeric value for the model
   */
  private gameTypeToNumeric(gameType: string): number {
    const gameTypes = {
      'battle_royale': 0,
      'fps': 1,
      'moba': 2,
      'sports': 3,
      'racing': 4,
      'card': 5
    };
    
    return gameTypes[gameType as keyof typeof gameTypes] || 0;
  }
  
  /**
   * Train the model with new match data
   */
  async trainModel(trainingData: {
    features: {
      gameType: string;
      teamSize: number;
      playerSkillLevels: number[];
      previousMatchesCount: number;
      timeOfDay: number;
    };
    actualDuration: number;
    actualScoreDifference: number;
    verificationSuccess: boolean;
  }[]): Promise<{
    mse: number;
    samplesProcessed: number;
  }> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }
    
    try {
      // Prepare training data
      const featureArrays = trainingData.map(data => [
        data.features.teamSize,
        this.gameTypeToNumeric(data.features.gameType),
        Math.max(...data.features.playerSkillLevels),
        Math.min(...data.features.playerSkillLevels),
        data.features.playerSkillLevels.reduce((a, b) => a + b, 0) / data.features.playerSkillLevels.length,
        data.features.previousMatchesCount,
        data.features.timeOfDay,
        data.features.timeOfDay < 12 ? 1 : 0,
        data.features.timeOfDay >= 12 && data.features.timeOfDay < 18 ? 1 : 0,
        data.features.timeOfDay >= 18 ? 1 : 0
      ]);
      
      const labelArrays = trainingData.map(data => [
        data.actualDuration,
        data.actualScoreDifference,
        data.verificationSuccess ? 1 : 0
      ]);
      
      const xs = tf.tensor2d(featureArrays);
      const ys = tf.tensor2d(labelArrays);
      
      // Train the model
      const history = await this.model!.fit(xs, ys, {
        epochs: config.modelSettings.matchAutomation.epochs,
        batchSize: config.modelSettings.matchAutomation.batchSize,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/${config.modelSettings.matchAutomation.epochs} - loss: ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      // Save the updated model
      await this.model!.save(`file://${this.modelPath}`);
      
      // Return training metrics
      const lastEpoch = history.history.loss.length - 1;
      return {
        mse: history.history.mse[lastEpoch],
        samplesProcessed: trainingData.length
      };
    } catch (error) {
      console.error('Error training match automation model:', error);
      throw new Error('Failed to train model');
    }
  }
  
  /**
   * Schedule automated actions for a match
   */
  async scheduleMatchActions(matchId: string, tournamentId: string, startTime: Date, expectedDuration: number): Promise<{
    scheduledActions: {
      type: 'start' | 'reminder' | 'end';
      scheduledTime: Date;
    }[];
  }> {
    // In a real implementation, this would use a job scheduler like Bull
    const now = new Date();
    const actions = [];
    
    // Start action
    if (startTime > now) {
      actions.push({
        type: 'start' as const,
        scheduledTime: startTime
      });
    }
    
    // Reminder (halfway through)
    const halfwayTime = new Date(startTime.getTime() + (expectedDuration * 60000) / 2);
    if (halfwayTime > now) {
      actions.push({
        type: 'reminder' as const,
        scheduledTime: halfwayTime
      });
    }
    
    // End action
    const endTime = new Date(startTime.getTime() + expectedDuration * 60000);
    actions.push({
      type: 'end' as const,
      scheduledTime: endTime
    });
    
    // In a real implementation, these would be scheduled with a job queue
    console.log(`Scheduled ${actions.length} actions for match ${matchId} in tournament ${tournamentId}`);
    
    return {
      scheduledActions: actions
    };
  }
}

export default new MatchAutomationService();
