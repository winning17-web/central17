import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import config from '../config';
import ScreenshotVerificationService from '../services/ScreenshotVerificationService';
import ScreenshotVerification from '../models/ScreenshotVerification';

// Set up multer storage for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create directory if it doesn't exist
    if (!fs.existsSync(config.storagePaths.screenshots)) {
      fs.mkdirSync(config.storagePaths.screenshots, { recursive: true });
    }
    cb(null, config.storagePaths.screenshots);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to only allow image files
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (config.modelSettings.screenshotVerification.supportedFormats.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Only JPEG, PNG, and WebP are allowed.'));
  }
};

// Set up multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.modelSettings.screenshotVerification.maxImageSize
  }
});

// Create router
const router = express.Router();

/**
 * @route POST /api/screenshots/verify
 * @desc Verify a screenshot using AI
 * @access Private
 */
router.post('/verify', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No screenshot provided' });
    }

    const { tournamentId, matchId, gameType } = req.body;
    
    if (!tournamentId || !matchId || !gameType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: tournamentId, matchId, and gameType are required' 
      });
    }

    // Verify the screenshot
    const verificationResult = await ScreenshotVerificationService.verifyScreenshot(
      req.file.path,
      gameType
    );

    // Create a verification record
    const verification = new ScreenshotVerification({
      tournamentId,
      matchId,
      submittedBy: req.body.userId || 'anonymous',
      imageUrl: req.file.path,
      verificationStatus: verificationResult.isValid ? 'verified' : 'pending',
      aiConfidence: verificationResult.confidence,
      aiVerdict: verificationResult.isValid,
      gameData: {
        gameType,
        scores: verificationResult.scores,
        players: Object.keys(verificationResult.scores),
        timestamp: new Date(),
        detectedText: verificationResult.detectedText
      }
    });

    await verification.save();

    return res.status(200).json({
      success: true,
      verification: {
        id: verification._id,
        isValid: verificationResult.isValid,
        confidence: verificationResult.confidence,
        status: verification.verificationStatus,
        scores: verificationResult.scores,
        detectedText: verificationResult.detectedText
      }
    });
  } catch (error) {
    console.error('Error verifying screenshot:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify screenshot',
      error: error.message
    });
  }
});

/**
 * @route GET /api/screenshots/:id
 * @desc Get a screenshot verification by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const verification = await ScreenshotVerification.findById(req.params.id);
    
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Verification not found' });
    }

    return res.status(200).json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('Error getting screenshot verification:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get verification',
      error: error.message
    });
  }
});

/**
 * @route POST /api/screenshots/:id/feedback
 * @desc Provide feedback on a verification result
 * @access Private
 */
router.post('/:id/feedback', async (req, res) => {
  try {
    const { isCorrect, notes } = req.body;
    
    if (typeof isCorrect !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'isCorrect field is required and must be a boolean' 
      });
    }

    const verification = await ScreenshotVerification.findById(req.params.id);
    
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Verification not found' });
    }

    // Update the verification with feedback
    verification.feedback = {
      isCorrect,
      notes: notes || ''
    };

    await verification.save();

    // If feedback indicates AI was wrong, this would be valuable training data
    if (verification.aiVerdict !== isCorrect) {
      // In a real implementation, this would queue the sample for retraining
      console.log(`AI verification was incorrect for ${req.params.id}. Queuing for retraining.`);
    }

    return res.status(200).json({
      success: true,
      message: 'Feedback recorded successfully',
      verification
    });
  } catch (error) {
    console.error('Error providing feedback:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to record feedback',
      error: error.message
    });
  }
});

export default router;
