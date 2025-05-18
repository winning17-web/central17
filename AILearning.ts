import mongoose, { Document, Schema } from 'mongoose';

// Interface for the AI Learning document
export interface IAILearning extends Document {
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
  userFeedback: {
    userId: string;
    isPositive: boolean;
    comment: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Schema for the AI Learning
const AILearningSchema: Schema = new Schema(
  {
    modelId: {
      type: String,
      required: true,
      ref: 'AIModel'
    },
    type: {
      type: String,
      required: true,
      enum: ['screenshot-verification', 'match-automation']
    },
    trainingSession: {
      startTime: {
        type: Date,
        required: true
      },
      endTime: {
        type: Date,
        required: true
      },
      samplesProcessed: {
        type: Number,
        required: true
      },
      accuracy: {
        type: Number,
        required: true
      },
      loss: {
        type: Number,
        required: true
      }
    },
    improvements: [{
      metricName: {
        type: String,
        required: true
      },
      previousValue: {
        type: Number,
        required: true
      },
      newValue: {
        type: Number,
        required: true
      },
      percentageImprovement: {
        type: Number,
        required: true
      }
    }],
    userFeedback: [{
      userId: {
        type: String,
        required: true
      },
      isPositive: {
        type: Boolean,
        required: true
      },
      comment: {
        type: String,
        default: ''
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

// Create and export the model
export default mongoose.model<IAILearning>('AILearning', AILearningSchema);
