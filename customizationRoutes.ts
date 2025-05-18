import express from 'express';
import AICustomizationService from '../services/AICustomizationService';

// Create router
const router = express.Router();

/**
 * @route POST /api/customization
 * @desc Create a new AI customization
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      createdBy,
      userRole,
      settings,
      description
    } = req.body;
    
    if (!name || !type || !createdBy || !userRole || !settings || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const customization = await AICustomizationService.createCustomization({
      name,
      type,
      createdBy,
      userRole,
      settings,
      description
    });

    return res.status(201).json({
      success: true,
      customization
    });
  } catch (error) {
    console.error('Error creating AI customization:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create customization',
      error: error.message
    });
  }
});

/**
 * @route GET /api/customization
 * @desc Get AI customizations
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    
    const customizations = await AICustomizationService.getCustomizations(
      type as string,
      status as string
    );

    return res.status(200).json({
      success: true,
      customizations
    });
  } catch (error) {
    console.error('Error getting AI customizations:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get customizations',
      error: error.message
    });
  }
});

/**
 * @route POST /api/customization/:id/vote
 * @desc Vote on an AI customization
 * @access Private
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { userId, vote } = req.body;
    
    if (!userId || !vote || !['up', 'down'].includes(vote)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing or invalid required fields' 
      });
    }

    const customization = await AICustomizationService.voteOnCustomization(
      req.params.id,
      userId,
      vote as 'up' | 'down'
    );

    return res.status(200).json({
      success: true,
      message: 'Vote recorded',
      customization
    });
  } catch (error) {
    console.error('Error voting on AI customization:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to record vote',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/customization/:id/status
 * @desc Update customization status
 * @access Private (Admin only)
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['approved', 'rejected', 'active'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status provided' 
      });
    }

    const customization = await AICustomizationService.updateCustomizationStatus(
      req.params.id,
      status as 'approved' | 'rejected' | 'active'
    );

    return res.status(200).json({
      success: true,
      message: `Customization status updated to ${status}`,
      customization
    });
  } catch (error) {
    console.error('Error updating customization status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update status',
      error: error.message
    });
  }
});

export default router;
