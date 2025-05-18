import mongoose, { Document, Schema } from 'mongoose';

// Interface for the AI model document
export interface IAIModel extends Document {
  name: string;
  version: string;
  type: 'screenshot-verification' | 'match-automation';
  path: string;
  accuracy: number;
  trainingData: {
    samples: number;
    lastUpdated: Date;
  };
  parameters: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for the AI model
const AIModelSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    version: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['screenshot-verification', 'match-automation']
    },
    path: {
      type: String,
      required: true
    },
    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    trainingData: {
      samples: {
        type: Number,
        required: true,
        default: 0
      },
      lastUpdated: {
        type: Date,
        required: true,
        default: Date.now
      }
    },
    parameters: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Create and export the model
export default mongoose.model<IAIModel>('AIModel', AIModelSchema);
