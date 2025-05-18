import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import config from '../config';

/**
 * Service for handling screenshot verification using TensorFlow.js
 */
class ScreenshotVerificationService {
  private model: tf.LayersModel | null = null;
  private modelPath: string;
  private isModelLoaded: boolean = false;
  
  constructor() {
    this.modelPath = path.join(config.storagePaths.models, 'screenshot-verification');
  }
  
  /**
   * Load the TensorFlow model for screenshot verification
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
          console.log('Loaded existing screenshot verification model');
        } catch (error) {
          console.error('Error loading model, initializing new one:', error);
          await this.initializeNewModel();
        }
      }
      
      this.isModelLoaded = true;
      return true;
    } catch (error) {
      console.error('Failed to load screenshot verification model:', error);
      return false;
    }
  }
  
  /**
   * Initialize a new model for screenshot verification
   */
  private async initializeNewModel(): Promise<void> {
    // Create a simple convolutional neural network for image classification
    const model = tf.sequential();
    
    // Add layers to the model
    model.add(tf.layers.conv2d({
      inputShape: [224, 224, 3],
      filters: 16,
      kernelSize: 3,
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
    model.add(tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.5 }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    
    // Compile the model
    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.model = model;
    
    // Save the model
    await this.model.save(`file://${this.modelPath}`);
    console.log('Initialized and saved new screenshot verification model');
  }
  
  /**
   * Preprocess an image for the model
   */
  private async preprocessImage(imagePath: string): Promise<tf.Tensor4D> {
    // Resize and normalize the image
    const imageBuffer = await sharp(imagePath)
      .resize(224, 224)
      .toBuffer();
    
    // Convert to tensor and normalize
    const tensor = tf.node.decodeImage(imageBuffer, 3);
    const normalized = tensor.div(255.0).expandDims(0) as tf.Tensor4D;
    
    tensor.dispose();
    return normalized;
  }
  
  /**
   * Verify a screenshot using the AI model
   */
  async verifyScreenshot(imagePath: string, gameType: string): Promise<{
    isValid: boolean;
    confidence: number;
    detectedText: string[];
    scores: Record<string, number>;
  }> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }
    
    try {
      // Preprocess the image
      const preprocessedImage = await this.preprocessImage(imagePath);
      
      // Make prediction
      const prediction = this.model!.predict(preprocessedImage) as tf.Tensor;
      const confidence = (await prediction.data())[0];
      
      // Clean up tensors
      preprocessedImage.dispose();
      prediction.dispose();
      
      // Determine if the screenshot is valid based on confidence threshold
      const isValid = confidence >= config.modelSettings.screenshotVerification.confidenceThreshold;
      
      // Mock text detection and score extraction (in a real implementation, this would use OCR)
      const detectedText = ['Player1', 'Score: 10', 'Player2', 'Score: 5'];
      const scores = { 'Player1': 10, 'Player2': 5 };
      
      return {
        isValid,
        confidence,
        detectedText,
        scores
      };
    } catch (error) {
      console.error('Error verifying screenshot:', error);
      throw new Error('Failed to verify screenshot');
    }
  }
  
  /**
   * Train the model with new data
   */
  async trainModel(trainingData: {
    imagePath: string;
    isValid: boolean;
  }[]): Promise<{
    accuracy: number;
    loss: number;
  }> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }
    
    try {
      // Prepare training data
      const batchSize = config.modelSettings.matchAutomation.batchSize;
      const epochs = config.modelSettings.matchAutomation.epochs;
      
      // Process images and create tensors
      const imagePromises = trainingData.map(data => this.preprocessImage(data.imagePath));
      const images = await Promise.all(imagePromises);
      const labels = tf.tensor1d(trainingData.map(data => data.isValid ? 1 : 0));
      
      // Concatenate all image tensors
      const xs = tf.concat(images, 0);
      
      // Train the model
      const history = await this.model!.fit(xs, labels, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/${epochs} - loss: ${logs?.loss.toFixed(4)} - accuracy: ${logs?.acc.toFixed(4)}`);
          }
        }
      });
      
      // Clean up tensors
      xs.dispose();
      labels.dispose();
      images.forEach(tensor => tensor.dispose());
      
      // Save the updated model
      await this.model!.save(`file://${this.modelPath}`);
      
      // Return training metrics
      const lastEpoch = history.history.loss.length - 1;
      return {
        accuracy: history.history.acc[lastEpoch],
        loss: history.history.loss[lastEpoch]
      };
    } catch (error) {
      console.error('Error training screenshot verification model:', error);
      throw new Error('Failed to train model');
    }
  }
}

export default new ScreenshotVerificationService();
