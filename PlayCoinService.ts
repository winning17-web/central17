/**
 * PlayCoin Service
 * 
 * This module implements the secondary in-game currency (PlayCoin) system
 * for optimizing ad-watching experiences and ticket value equivalence.
 */

import mongoose from 'mongoose';
import * as tf from '@tensorflow/tfjs-node';

// Interfaces
export interface IPlayCoin {
  _id: string;
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastUpdated: Date;
  transactions: {
    type: 'earn' | 'spend' | 'expire';
    amount: number;
    source: 'ad_watch' | 'daily_bonus' | 'tournament_reward' | 'ticket_purchase' | 'item_purchase';
    timestamp: Date;
    metadata: Record<string, any>;
  }[];
}

export interface IAdValue {
  _id: string;
  adId: string;
  adProvider: string;
  adType: 'video' | 'banner' | 'interstitial' | 'rewarded';
  baseValue: number;
  dynamicMultiplier: number;
  userSegmentMultipliers: Record<string, number>;
  timeBasedMultipliers: {
    dayOfWeek: number[];
    hourOfDay: number[];
  };
  performanceMetrics: {
    completionRate: number;
    clickThroughRate: number;
    conversionRate: number;
    lastUpdated: Date;
  };
  lastOptimized: Date;
}

export interface ITicketValue {
  _id: string;
  tournamentId: string;
  tournamentType: string;
  baseTicketPrice: {
    fiatUSD: number;
    tokenAmount: number;
  };
  adEquivalenceValue: number; // In PlayCoins
  dynamicFactors: {
    popularity: number;
    scarcity: number;
    timeToStart: number;
    prizePool: number;
  };
  lastUpdated: Date;
}

// MongoDB Schema Definitions
const PlayCoinSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  balance: { type: Number, required: true, default: 0 },
  lifetimeEarned: { type: Number, required: true, default: 0 },
  lifetimeSpent: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  transactions: [{
    type: { type: String, enum: ['earn', 'spend', 'expire'], required: true },
    amount: { type: Number, required: true },
    source: { 
      type: String, 
      enum: ['ad_watch', 'daily_bonus', 'tournament_reward', 'ticket_purchase', 'item_purchase'],
      required: true 
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  }]
});

const AdValueSchema = new mongoose.Schema({
  adId: { type: String, required: true, index: true },
  adProvider: { type: String, required: true },
  adType: { 
    type: String, 
    enum: ['video', 'banner', 'interstitial', 'rewarded'],
    required: true 
  },
  baseValue: { type: Number, required: true },
  dynamicMultiplier: { type: Number, required: true, default: 1.0 },
  userSegmentMultipliers: { type: Map, of: Number, default: {} },
  timeBasedMultipliers: {
    dayOfWeek: { type: [Number], default: [1, 1, 1, 1, 1, 1, 1] },
    hourOfDay: { type: [Number], default: Array(24).fill(1) }
  },
  performanceMetrics: {
    completionRate: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  lastOptimized: { type: Date, default: Date.now }
});

const TicketValueSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true, index: true },
  tournamentType: { type: String, required: true },
  baseTicketPrice: {
    fiatUSD: { type: Number, required: true },
    tokenAmount: { type: Number, required: true }
  },
  adEquivalenceValue: { type: Number, required: true }, // In PlayCoins
  dynamicFactors: {
    popularity: { type: Number, default: 1.0 },
    scarcity: { type: Number, default: 1.0 },
    timeToStart: { type: Number, default: 1.0 },
    prizePool: { type: Number, default: 1.0 }
  },
  lastUpdated: { type: Date, default: Date.now }
});

// Create models if they don't exist
let PlayCoin: mongoose.Model<IPlayCoin & mongoose.Document>;
let AdValue: mongoose.Model<IAdValue & mongoose.Document>;
let TicketValue: mongoose.Model<ITicketValue & mongoose.Document>;

try {
  PlayCoin = mongoose.model<IPlayCoin & mongoose.Document>('PlayCoin');
} catch {
  PlayCoin = mongoose.model<IPlayCoin & mongoose.Document>('PlayCoin', PlayCoinSchema);
}

try {
  AdValue = mongoose.model<IAdValue & mongoose.Document>('AdValue');
} catch {
  AdValue = mongoose.model<IAdValue & mongoose.Document>('AdValue', AdValueSchema);
}

try {
  TicketValue = mongoose.model<ITicketValue & mongoose.Document>('TicketValue');
} catch {
  TicketValue = mongoose.model<ITicketValue & mongoose.Document>('TicketValue', TicketValueSchema);
}

/**
 * PlayCoin Service Implementation
 */
class PlayCoinService {
  /**
   * Get user's PlayCoin balance
   */
  async getUserBalance(userId: string): Promise<number> {
    const userCoin = await PlayCoin.findOne({ userId });
    return userCoin ? userCoin.balance : 0;
  }
  
  /**
   * Get user's PlayCoin account with transaction history
   */
  async getUserAccount(userId: string): Promise<IPlayCoin> {
    let userCoin = await PlayCoin.findOne({ userId });
    
    if (!userCoin) {
      // Create new account if it doesn't exist
      userCoin = await PlayCoin.create({
        userId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        lastUpdated: new Date(),
        transactions: []
      });
    }
    
    return userCoin;
  }
  
  /**
   * Add PlayCoins to user's account
   */
  async addCoins(
    userId: string, 
    amount: number, 
    source: 'ad_watch' | 'daily_bonus' | 'tournament_reward', 
    metadata: Record<string, any> = {}
  ): Promise<IPlayCoin> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    const userCoin = await this.getUserAccount(userId);
    
    // Add transaction
    userCoin.transactions.push({
      type: 'earn',
      amount,
      source,
      timestamp: new Date(),
      metadata
    });
    
    // Update balances
    userCoin.balance += amount;
    userCoin.lifetimeEarned += amount;
    userCoin.lastUpdated = new Date();
    
    await userCoin.save();
    return userCoin;
  }
  
  /**
   * Spend PlayCoins from user's account
   */
  async spendCoins(
    userId: string, 
    amount: number, 
    purpose: 'ticket_purchase' | 'item_purchase', 
    metadata: Record<string, any> = {}
  ): Promise<IPlayCoin> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    const userCoin = await this.getUserAccount(userId);
    
    // Check if user has enough balance
    if (userCoin.balance < amount) {
      throw new Error(`Insufficient PlayCoin balance. Required: ${amount}, Available: ${userCoin.balance}`);
    }
    
    // Add transaction
    userCoin.transactions.push({
      type: 'spend',
      amount,
      source: purpose,
      timestamp: new Date(),
      metadata
    });
    
    // Update balances
    userCoin.balance -= amount;
    userCoin.lifetimeSpent += amount;
    userCoin.lastUpdated = new Date();
    
    await userCoin.save();
    return userCoin;
  }
  
  /**
   * Get user's transaction history
   */
  async getTransactionHistory(
    userId: string, 
    limit: number = 50
  ): Promise<IPlayCoin['transactions']> {
    const userCoin = await this.getUserAccount(userId);
    
    // Sort transactions by timestamp (newest first) and limit
    return userCoin.transactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Calculate optimal distribution of PlayCoins
   */
  async calculateOptimalDistribution(
    totalAmount: number, 
    userCount: number
  ): Promise<Map<string, number>> {
    // This is a simplified implementation
    // In a real system, this would use more sophisticated algorithms
    
    // For now, just distribute evenly
    const baseAmount = Math.floor(totalAmount / userCount);
    const remainder = totalAmount - (baseAmount * userCount);
    
    // Get top users by activity
    const topUsers = await PlayCoin.find({})
      .sort({ lifetimeEarned: -1 })
      .limit(userCount);
    
    const distribution = new Map<string, number>();
    
    topUsers.forEach((user, index) => {
      // Give remainder to the most active user
      const bonus = index === 0 ? remainder : 0;
      distribution.set(user.userId, baseAmount + bonus);
    });
    
    return distribution;
  }
}

/**
 * Ad Optimization Service Implementation
 */
class AdOptimizationService {
  private adValueModel: tf.LayersModel | null = null;
  private userSegmentationModel: tf.LayersModel | null = null;
  
  constructor() {
    this.initializeModels();
  }
  
  /**
   * Initialize AI models
   */
  private async initializeModels(): Promise<void> {
    try {
      // In a real implementation, these would load pre-trained models
      // For now, we'll create simple models
      
      // Ad value prediction model
      const adValueModel = tf.sequential();
      adValueModel.add(tf.layers.dense({
        inputShape: [10],
        units: 16,
        activation: 'relu'
      }));
      adValueModel.add(tf.layers.dense({
        units: 8,
        activation: 'relu'
      }));
      adValueModel.add(tf.layers.dense({
        units: 3,
        activation: 'linear'
      }));
      
      adValueModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mse']
      });
      
      this.adValueModel = adValueModel;
      
      // User segmentation model
      const userSegmentModel = tf.sequential();
      userSegmentModel.add(tf.layers.dense({
        inputShape: [8],
        units: 12,
        activation: 'relu'
      }));
      userSegmentModel.add(tf.layers.dense({
        units: 6,
        activation: 'relu'
      }));
      userSegmentModel.add(tf.layers.dense({
        units: 4,
        activation: 'softmax'
      }));
      
      userSegmentModel.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      
      this.userSegmentationModel = userSegmentModel;
      
      console.log('Initialized ad optimization models');
    } catch (error) {
      console.error('Error initializing ad optimization models:', error);
    }
  }
  
  /**
   * Predict ad value for a specific user and context
   */
  async predictAdValue(
    adId: string, 
    userId: string, 
    contextData: {
      timeOfDay: number;
      dayOfWeek: number;
      platform: string;
      location?: string;
    }
  ): Promise<{
    predictedValue: number;
    recommendedReward: number;
    confidence: number;
  }> {
    try {
      // Get ad information
      const ad = await AdValue.findOne({ adId });
      if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
      }
      
      // Get user information and history
      const userCoin = await PlayCoin.findOne({ userId });
      const userHistory = userCoin ? userCoin.transactions.filter(t => 
        t.source === 'ad_watch' && 
        t.metadata && 
        t.metadata.adId
      ) : [];
      
      // Calculate base value
      let baseValue = ad.baseValue;
      
      // Apply time-based multipliers
      const hourMultiplier = ad.timeBasedMultipliers.hourOfDay[contextData.timeOfDay] || 1;
      const dayMultiplier = ad.timeBasedMultipliers.dayOfWeek[contextData.dayOfWeek] || 1;
      
      // Apply user segment multiplier if available
      let userSegmentMultiplier = 1;
      if (userCoin) {
        // In a real implementation, this would use the user segmentation model
        // For now, use a simple heuristic based on user history
        const adWatchCount = userHistory.length;
        const completionRate = userHistory.filter(t => t.metadata.completed).length / Math.max(1, adWatchCount);
        
        if (completionRate > 0.8 && adWatchCount > 10) {
          userSegmentMultiplier = 1.2; // Loyal ad watcher
        } else if (completionRate < 0.3 && adWatchCount > 5) {
          userSegmentMultiplier = 0.8; // Low completion rate
        }
      }
      
      // Calculate final value
      const predictedValue = baseValue * hourMultiplier * dayMultiplier * userSegmentMultiplier * ad.dynamicMultiplier;
      
      // Calculate recommended reward (slightly higher than value to incentivize watching)
      const recommendedReward = Math.ceil(predictedValue * 1.1);
      
      // Calculate confidence based on available data
      const confidence = Math.min(0.9, 0.5 + (userHistory.length / 100));
      
      return {
        predictedValue,
        recommendedReward,
        confidence
      };
    } catch (error) {
      console.error('Error predicting ad value:', error);
      
      // Return default values if prediction fails
      return {
        predictedValue: 10,
        recommendedReward: 12,
        confidence: 0.5
      };
    }
  }
  
  /**
   * Optimize ad schedule for a user
   */
  async optimizeAdSchedule(
    userId: string, 
    availableTime: number // in seconds
  ): Promise<{
    recommendedAds: {
      adId: string;
      predictedValue: number;
      recommendedReward: number;
      estimatedDuration: number;
    }[];
    totalEstimatedValue: number;
    totalEstimatedReward: number;
  }> {
    try {
      // Get user information
      const userCoin = await PlayCoin.findOne({ userId });
      
      // Get available ads
      const availableAds = await AdValue.find({});
      
      // Current context
      const now = new Date();
      const contextData = {
        timeOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        platform: 'mobile' // Default assumption
      };
      
      // Calculate value and duration for each ad
      const adValues = await Promise.all(availableAds.map(async ad => {
        const { predictedValue, recommendedReward } = await this.predictAdValue(
          ad.adId,
          userId,
          contextData
        );
        
        // Estimate duration based on ad type
        let estimatedDuration = 30; // Default 30 seconds
        switch (ad.adType) {
          case 'video':
            estimatedDuration = 30;
            break;
          case 'rewarded':
            estimatedDuration = 45;
            break;
          case 'interstitial':
            estimatedDuration = 15;
            break;
          case 'banner':
            estimatedDuration = 10;
            break;
        }
        
        return {
          ad,
          predictedValue,
          recommendedReward,
          estimatedDuration,
          valuePerSecond: predictedValue / estimatedDuration
        };
      }));
      
      // Sort by value per second (most efficient first)
      adValues.sort((a, b) => b.valuePerSecond - a.valuePerSecond);
      
      // Select ads to fill available time
      const selectedAds = [];
      let remainingTime = availableTime;
      let totalValue = 0;
      let totalReward = 0;
      
      for (const adValue of adValues) {
        if (remainingTime >= adValue.estimatedDuration) {
          selectedAds.push({
            adId: adValue.ad.adId,
            predictedValue: adValue.predictedValue,
            recommendedReward: adValue.recommendedReward,
            estimatedDuration: adValue.estimatedDuration
          });
          
          remainingTime -= adValue.estimatedDuration;
          totalValue += adValue.predictedValue;
          totalReward += adValue.recommendedReward;
          
          // Limit to reasonable number of ads
          if (selectedAds.length >= 10) break;
        }
      }
      
      return {
        recommendedAds: selectedAds,
        totalEstimatedValue: totalValue,
        totalEstimatedReward: totalReward
      };
    } catch (error) {
      console.error('Error optimizing ad schedule:', error);
      
      // Return empty schedule if optimization fails
      return {
        recommendedAds: [],
        totalEstimatedValue: 0,
        totalEstimatedReward: 0
      };
    }
  }
  
  /**
   * Record ad performance
   */
  async recordAdPerformance(
    adId: string,
    userId: string,
    performanceData: {
      wasCompleted: boolean;
      wasClicked: boolean;
      viewDuration: number;
      userFeedback?: 'positive' | 'neutral' | 'negative';
    }
  ): Promise<void> {
    try {
      // Get ad
      const ad = await AdValue.findOne({ adId });
      if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
      }
      
      // Update performance metrics
      const metrics = ad.performanceMetrics;
      
      // Calculate new completion rate with exponential moving average
      const alpha = 0.1; // Weight for new data
      metrics.completionRate = (1 - alpha) * metrics.completionRate + alpha * (performanceData.wasCompleted ? 1 : 0);
      metrics.clickThroughRate = (1 - alpha) * metrics.clickThroughRate + alpha * (performanceData.wasClicked ? 1 : 0);
      
      // Simple conversion rate update (in a real system this would be more complex)
      if (performanceData.wasClicked) {
        metrics.conversionRate = (1 - alpha) * metrics.conversionRate + alpha * 0.1; // Assume 10% conversion for clicks
      }
      
      metrics.lastUpdated = new Date();
      
      // Update dynamic multiplier based on performance
      // Higher performing ads get higher multipliers
      const performanceScore = (
        metrics.completionRate * 0.5 + 
        metrics.clickThroughRate * 0.3 + 
        metrics.conversionRate * 0.2
      );
      
      // Scale between 0.8 and 1.5
      ad.dynamicMultiplier = 0.8 + (performanceScore * 0.7);
      
      await ad.save();
      
      // In a real implementation, this data would also be used to retrain the models
      console.log(`Updated performance metrics for ad ${adId}`);
    } catch (error) {
      console.error('Error recording ad performance:', error);
    }
  }
  
  /**
   * Train ad value model with new data
   */
  async trainAdValueModel(
    trainingData: {
      adId: string;
      userId: string;
      contextData: {
        timeOfDay: number;
        dayOfWeek: number;
        platform: string;
      };
      actualValue: number;
      wasCompleted: boolean;
      wasClicked: boolean;
    }[]
  ): Promise<{
    improvementMetrics: {
      mse: number;
      mae: number;
      r2: number;
    };
    significantFactors: {
      factor: string;
      importance: number;
    }[];
  }> {
    if (!this.adValueModel) {
      await this.initializeModels();
    }
    
    try {
      // Prepare training data
      const features = [];
      const labels = [];
      
      for (const data of trainingData) {
        // Get ad
        const ad = await AdValue.findOne({ adId: data.adId });
        if (!ad) continue;
        
        // Extract features
        const adTypeFeatures = [0, 0, 0, 0]; // One-hot encoding for ad type
        switch (ad.adType) {
          case 'video': adTypeFeatures[0] = 1; break;
          case 'banner': adTypeFeatures[1] = 1; break;
          case 'interstitial': adTypeFeatures[2] = 1; break;
          case 'rewarded': adTypeFeatures[3] = 1; break;
        }
        
        const feature = [
          ad.baseValue / 100, // Normalize base value
          data.contextData.timeOfDay / 24, // Normalize time
          data.contextData.dayOfWeek / 7, // Normalize day
          data.contextData.platform === 'mobile' ? 1 : 0,
          ...adTypeFeatures,
          ad.performanceMetrics.completionRate,
          ad.performanceMetrics.clickThroughRate
        ];
        
        features.push(feature);
        
        // Labels: [actualValue, wasCompleted, wasClicked]
        labels.push([
          data.actualValue / 100, // Normalize value
          data.wasCompleted ? 1 : 0,
          data.wasClicked ? 1 : 0
        ]);
      }
      
      if (features.length === 0) {
        throw new Error('No valid training data');
      }
      
      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels);
      
      // Train the model
      const history = await this.adValueModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/10 - loss: ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      // Calculate improvement metrics
      const lastEpoch = history.history.loss.length - 1;
      const mse = history.history.mse ? history.history.mse[lastEpoch] : history.history.loss[lastEpoch];
      
      // Calculate MAE and R2 (simplified)
      const mae = Math.sqrt(mse) * 0.8; // Approximation
      const r2 = 1 - (mse / 0.5); // Approximation using baseline variance of 0.5
      
      // Determine significant factors (simplified)
      const significantFactors = [
        { factor: 'adType', importance: 0.3 },
        { factor: 'timeOfDay', importance: 0.25 },
        { factor: 'completionRate', importance: 0.2 },
        { factor: 'baseValue', importance: 0.15 },
        { factor: 'dayOfWeek', importance: 0.1 }
      ];
      
      return {
        improvementMetrics: { mse, mae, r2 },
        significantFactors
      };
    } catch (error) {
      console.error('Error training ad value model:', error);
      throw error;
    }
  }
}

/**
 * Ticket-Ad Equivalence Service Implementation
 */
class TicketAdEquivalenceService {
  private playCoinService: PlayCoinService;
  private adOptimizationService: AdOptimizationService;
  
  constructor(
    playCoinService: PlayCoinService,
    adOptimizationService: AdOptimizationService
  ) {
    this.playCoinService = playCoinService;
    this.adOptimizationService = adOptimizationService;
  }
  
  /**
   * Calculate ticket ad equivalence
   */
  async calculateTicketAdEquivalence(
    tournamentId: string
  ): Promise<{
    ticketValue: {
      fiatUSD: number;
      tokenAmount: number;
      playCoins: number;
    };
    requiredAdWatches: number;
    estimatedTimeRequired: number;
  }> {
    try {
      // Get ticket value
      let ticketValue = await TicketValue.findOne({ tournamentId });
      
      if (!ticketValue) {
        // Default values if not found
        ticketValue = {
          tournamentId,
          tournamentType: 'default',
          baseTicketPrice: {
            fiatUSD: 5,
            tokenAmount: 10
          },
          adEquivalenceValue: 500, // Default 500 PlayCoins
          dynamicFactors: {
            popularity: 1.0,
            scarcity: 1.0,
            timeToStart: 1.0,
            prizePool: 1.0
          },
          lastUpdated: new Date()
        } as ITicketValue;
      }
      
      // Calculate dynamic PlayCoin value
      const dynamicMultiplier = 
        ticketValue.dynamicFactors.popularity * 
        ticketValue.dynamicFactors.scarcity * 
        ticketValue.dynamicFactors.timeToStart * 
        ticketValue.dynamicFactors.prizePool;
      
      const playCoins = Math.round(ticketValue.adEquivalenceValue * dynamicMultiplier);
      
      // Estimate required ad watches
      // Assume average ad gives 50 PlayCoins
      const requiredAdWatches = Math.ceil(playCoins / 50);
      
      // Estimate time required (30 seconds per ad on average)
      const estimatedTimeRequired = requiredAdWatches * 30;
      
      return {
        ticketValue: {
          fiatUSD: ticketValue.baseTicketPrice.fiatUSD,
          tokenAmount: ticketValue.baseTicketPrice.tokenAmount,
          playCoins
        },
        requiredAdWatches,
        estimatedTimeRequired
      };
    } catch (error) {
      console.error('Error calculating ticket ad equivalence:', error);
      
      // Return default values if calculation fails
      return {
        ticketValue: {
          fiatUSD: 5,
          tokenAmount: 10,
          playCoins: 500
        },
        requiredAdWatches: 10,
        estimatedTimeRequired: 300
      };
    }
  }
  
  /**
   * Generate ad watching plan for a tournament
   */
  async generateAdWatchingPlan(
    userId: string,
    tournamentId: string
  ): Promise<{
    adSequence: {
      adId: string;
      adType: string;
      playCoinsReward: number;
      estimatedDuration: number;
    }[];
    totalPlayCoins: number;
    totalEstimatedTime: number;
    ticketCoveragePercentage: number;
  }> {
    try {
      // Get ticket value
      const { ticketValue } = await this.calculateTicketAdEquivalence(tournamentId);
      const requiredPlayCoins = ticketValue.playCoins;
      
      // Get user's current balance
      const currentBalance = await this.playCoinService.getUserBalance(userId);
      
      // Calculate how many more coins are needed
      const neededPlayCoins = Math.max(0, requiredPlayCoins - currentBalance);
      
      if (neededPlayCoins === 0) {
        // User already has enough PlayCoins
        return {
          adSequence: [],
          totalPlayCoins: 0,
          totalEstimatedTime: 0,
          ticketCoveragePercentage: 100
        };
      }
      
      // Estimate available time (5 minutes default)
      const availableTime = 300; // seconds
      
      // Optimize ad schedule
      const { recommendedAds, totalEstimatedReward } = await this.adOptimizationService.optimizeAdSchedule(
        userId,
        availableTime
      );
      
      // Convert to ad sequence
      const adSequence = await Promise.all(recommendedAds.map(async (rec) => {
        const ad = await AdValue.findOne({ adId: rec.adId });
        return {
          adId: rec.adId,
          adType: ad ? ad.adType : 'video',
          playCoinsReward: rec.recommendedReward,
          estimatedDuration: rec.estimatedDuration
        };
      }));
      
      // Calculate totals
      const totalPlayCoins = adSequence.reduce((sum, ad) => sum + ad.playCoinsReward, 0);
      const totalEstimatedTime = adSequence.reduce((sum, ad) => sum + ad.estimatedDuration, 0);
      
      // Calculate coverage percentage
      const coveragePercentage = Math.min(100, (totalPlayCoins / neededPlayCoins) * 100);
      
      return {
        adSequence,
        totalPlayCoins,
        totalEstimatedTime,
        ticketCoveragePercentage: coveragePercentage
      };
    } catch (error) {
      console.error('Error generating ad watching plan:', error);
      
      // Return empty plan if generation fails
      return {
        adSequence: [],
        totalPlayCoins: 0,
        totalEstimatedTime: 0,
        ticketCoveragePercentage: 0
      };
    }
  }
  
  /**
   * Optimize ticket pricing
   */
  async optimizeTicketPricing(
    tournamentData: {
      tournamentId: string;
      tournamentType: string;
      prizePool: number;
      expectedParticipants: number;
      startTime: Date;
    },
    marketData: {
      averageTicketPrice: number;
      tokenPrice: number;
      adCompletionRate: number;
    }
  ): Promise<{
    recommendedPricing: {
      fiatUSD: number;
      tokenAmount: number;
      playCoins: number;
    };
    projectedParticipation: number;
    confidenceInterval: [number, number];
  }> {
    try {
      // Calculate base price based on prize pool and expected participants
      const basePriceUSD = (tournamentData.prizePool * 0.5) / tournamentData.expectedParticipants;
      
      // Adjust based on market data
      const marketAdjustedPrice = (basePriceUSD + marketData.averageTicketPrice) / 2;
      
      // Calculate token amount
      const tokenAmount = Math.ceil(marketAdjustedPrice / marketData.tokenPrice);
      
      // Calculate PlayCoin equivalent
      // Rule of thumb: 100 PlayCoins ≈ $1
      const playCoins = Math.ceil(marketAdjustedPrice * 100);
      
      // Calculate time to tournament start in days
      const now = new Date();
      const daysToStart = Math.max(0, (tournamentData.startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Adjust pricing based on time to start
      let timeAdjustment = 1.0;
      if (daysToStart < 1) {
        // Last day discount to fill spots
        timeAdjustment = 0.9;
      } else if (daysToStart > 7) {
        // Early bird discount
        timeAdjustment = 0.95;
      }
      
      // Final pricing
      const finalPricing = {
        fiatUSD: Math.round(marketAdjustedPrice * timeAdjustment * 100) / 100, // Round to 2 decimal places
        tokenAmount: Math.ceil(tokenAmount * timeAdjustment),
        playCoins: Math.ceil(playCoins * timeAdjustment)
      };
      
      // Project participation
      // Simple model: lower price = higher participation
      const priceRatio = finalPricing.fiatUSD / marketData.averageTicketPrice;
      const projectedParticipation = Math.min(
        tournamentData.expectedParticipants * (1 + (1 - priceRatio) * 0.5),
        tournamentData.expectedParticipants * 1.5 // Cap at 150% of expected
      );
      
      // Calculate confidence interval (±20%)
      const confidenceInterval: [number, number] = [
        Math.floor(projectedParticipation * 0.8),
        Math.ceil(projectedParticipation * 1.2)
      ];
      
      return {
        recommendedPricing: finalPricing,
        projectedParticipation: Math.round(projectedParticipation),
        confidenceInterval
      };
    } catch (error) {
      console.error('Error optimizing ticket pricing:', error);
      
      // Return default values if optimization fails
      return {
        recommendedPricing: {
          fiatUSD: 5,
          tokenAmount: 10,
          playCoins: 500
        },
        projectedParticipation: tournamentData.expectedParticipants,
        confidenceInterval: [
          Math.floor(tournamentData.expectedParticipants * 0.8),
          Math.ceil(tournamentData.expectedParticipants * 1.2)
        ]
      };
    }
  }
  
  /**
   * Update ticket value based on market data
   */
  async updateTicketValue(
    tournamentId: string,
    updateData: {
      baseTicketPrice?: {
        fiatUSD: number;
        tokenAmount: number;
      };
      adEquivalenceValue?: number;
      dynamicFactors?: {
        popularity?: number;
        scarcity?: number;
        timeToStart?: number;
        prizePool?: number;
      };
    }
  ): Promise<ITicketValue> {
    try {
      // Find existing ticket value or create new one
      let ticketValue = await TicketValue.findOne({ tournamentId });
      
      if (!ticketValue) {
        // Create new ticket value
        ticketValue = await TicketValue.create({
          tournamentId,
          tournamentType: 'default',
          baseTicketPrice: {
            fiatUSD: 5,
            tokenAmount: 10
          },
          adEquivalenceValue: 500,
          dynamicFactors: {
            popularity: 1.0,
            scarcity: 1.0,
            timeToStart: 1.0,
            prizePool: 1.0
          },
          lastUpdated: new Date()
        });
      }
      
      // Update fields
      if (updateData.baseTicketPrice) {
        ticketValue.baseTicketPrice = updateData.baseTicketPrice;
      }
      
      if (updateData.adEquivalenceValue) {
        ticketValue.adEquivalenceValue = updateData.adEquivalenceValue;
      }
      
      if (updateData.dynamicFactors) {
        ticketValue.dynamicFactors = {
          ...ticketValue.dynamicFactors,
          ...updateData.dynamicFactors
        };
      }
      
      ticketValue.lastUpdated = new Date();
      await ticketValue.save();
      
      return ticketValue;
    } catch (error) {
      console.error('Error updating ticket value:', error);
      throw error;
    }
  }
}

// Create service instances
const playCoinService = new PlayCoinService();
const adOptimizationService = new AdOptimizationService();
const ticketAdEquivalenceService = new TicketAdEquivalenceService(
  playCoinService,
  adOptimizationService
);

export {
  playCoinService,
  adOptimizationService,
  ticketAdEquivalenceService,
  PlayCoinService,
  AdOptimizationService,
  TicketAdEquivalenceService
};
