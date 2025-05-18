import config from '../config';
import AIModel, { IAIModel } from '../models/AIModel';
import AICustomization, { IAICustomization } from '../models/AICustomization';
import AILearning, { IAILearning } from '../models/AILearning';

/**
 * Service for handling AI customization and learning
 */
class AICustomizationService {
  /**
   * Create a new customization proposal
   */
  async createCustomization(data: {
    name: string;
    type: 'match-automation' | 'screenshot-verification';
    createdBy: string;
    userRole: 'admin' | 'moderator' | 'community';
    settings: Record<string, any>;
    description: string;
  }): Promise<IAICustomization> {
    try {
      // Validate user permissions based on role and customization type
      this.validatePermissions(data.userRole, data.type);
      
      // Create the customization
      const customization = new AICustomization({
        ...data,
        status: data.userRole === 'admin' ? 'approved' : 'pending',
        votes: [],
        performance: {
          accuracy: 0,
          samplesProcessed: 0,
          lastEvaluated: null
        }
      });
      
      await customization.save();
      return customization;
    } catch (error) {
      console.error('Error creating AI customization:', error);
      throw error;
    }
  }
  
  /**
   * Validate user permissions for customization
   */
  private validatePermissions(userRole: string, customizationType: string): void {
    const allowedTypes = config.customizationLevels[userRole as keyof typeof config.customizationLevels] || [];
    
    if (allowedTypes.includes('all')) {
      return; // User has access to all customization types
    }
    
    if (!allowedTypes.includes(customizationType)) {
      throw new Error(`User with role ${userRole} does not have permission to customize ${customizationType}`);
    }
  }
  
  /**
   * Get customizations by type and status
   */
  async getCustomizations(type?: string, status?: string): Promise<IAICustomization[]> {
    try {
      const query: any = {};
      
      if (type) {
        query.type = type;
      }
      
      if (status) {
        query.status = status;
      }
      
      return await AICustomization.find(query).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting AI customizations:', error);
      throw error;
    }
  }
  
  /**
   * Vote on a community customization
   */
  async voteOnCustomization(customizationId: string, userId: string, vote: 'up' | 'down'): Promise<IAICustomization> {
    try {
      const customization = await AICustomization.findById(customizationId);
      
      if (!customization) {
        throw new Error('Customization not found');
      }
      
      // Check if user has already voted
      const existingVoteIndex = customization.votes.findIndex(v => v.userId === userId);
      
      if (existingVoteIndex >= 0) {
        // Update existing vote
        customization.votes[existingVoteIndex].vote = vote;
        customization.votes[existingVoteIndex].timestamp = new Date();
      } else {
        // Add new vote
        customization.votes.push({
          userId,
          vote,
          timestamp: new Date()
        });
      }
      
      // Check if customization should be auto-approved based on votes
      const upVotes = customization.votes.filter(v => v.vote === 'up').length;
      const totalVotes = customization.votes.length;
      
      if (customization.status === 'pending' && totalVotes >= 10 && (upVotes / totalVotes) >= 0.75) {
        customization.status = 'approved';
      }
      
      await customization.save();
      return customization;
    } catch (error) {
      console.error('Error voting on AI customization:', error);
      throw error;
    }
  }
  
  /**
   * Approve or reject a customization
   */
  async updateCustomizationStatus(customizationId: string, status: 'approved' | 'rejected' | 'active'): Promise<IAICustomization> {
    try {
      const customization = await AICustomization.findById(customizationId);
      
      if (!customization) {
        throw new Error('Customization not found');
      }
      
      customization.status = status;
      
      // If approved, create or update the AI model
      if (status === 'approved' || status === 'active') {
        await this.applyCustomizationToModel(customization);
      }
      
      await customization.save();
      return customization;
    } catch (error) {
      console.error('Error updating AI customization status:', error);
      throw error;
    }
  }
  
  /**
   * Apply customization to an AI model
   */
  private async applyCustomizationToModel(customization: IAICustomization): Promise<void> {
    try {
      // Find existing model or create a new one
      let model = await AIModel.findOne({
        type: customization.type,
        isActive: true
      });
      
      if (!model) {
        model = new AIModel({
          name: `${customization.type}-model`,
          version: '1.0.0',
          type: customization.type,
          path: `/models/${customization.type}`,
          accuracy: 0.7,
          trainingData: {
            samples: 0,
            lastUpdated: new Date()
          },
          parameters: {},
          isActive: true
        });
      }
      
      // Update model parameters with customization settings
      model.parameters = {
        ...model.parameters,
        ...customization.settings
      };
      
      // Increment version
      const versionParts = model.version.split('.');
      versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
      model.version = versionParts.join('.');
      
      await model.save();
      
      // In a real implementation, this would trigger model retraining or parameter updates
      console.log(`Applied customization ${customization._id} to model ${model._id}`);
    } catch (error) {
      console.error('Error applying customization to model:', error);
      throw error;
    }
  }
  
  /**
   * Record learning progress
   */
  async recordLearning(data: {
    modelId: string;
    type: 'screenshot-verification' | 'match-automation';
    trainingSession: {
      startTime: Date;
      endTime: Date;
      samplesProcessed: number;
      accuracy: number;
      loss: number;
    };
    improvements: {
      metricName: string;
      previousValue: number;
      newValue: number;
      percentageImprovement: number;
    }[];
  }): Promise<IAILearning> {
    try {
      const learning = new AILearning({
        ...data,
        userFeedback: []
      });
      
      await learning.save();
      
      // Update the model with new accuracy
      await AIModel.findByIdAndUpdate(data.modelId, {
        accuracy: data.trainingSession.accuracy,
        'trainingData.samples': { $inc: data.trainingSession.samplesProcessed },
        'trainingData.lastUpdated': data.trainingSession.endTime
      });
      
      return learning;
    } catch (error) {
      console.error('Error recording AI learning:', error);
      throw error;
    }
  }
  
  /**
   * Add user feedback to learning
   */
  async addLearningFeedback(learningId: string, feedback: {
    userId: string;
    isPositive: boolean;
    comment: string;
  }): Promise<IAILearning> {
    try {
      const learning = await AILearning.findById(learningId);
      
      if (!learning) {
        throw new Error('Learning record not found');
      }
      
      learning.userFeedback.push({
        ...feedback,
        timestamp: new Date()
      });
      
      await learning.save();
      return learning;
    } catch (error) {
      console.error('Error adding learning feedback:', error);
      throw error;
    }
  }
}

export default new AICustomizationService();
