import express from 'express';
import MatchAutomationService from '../services/MatchAutomationService';
import MatchAutomation from '../models/MatchAutomation';

// Create router
const router = express.Router();

/**
 * @route POST /api/matches/automate
 * @desc Create a new automated match
 * @access Private
 */
router.post('/automate', async (req, res) => {
  try {
    const {
      tournamentId,
      matchId,
      teams,
      gameType,
      startTime,
      automationSettings
    } = req.body;
    
    if (!tournamentId || !matchId || !teams || !gameType || !startTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Calculate expected match parameters using AI
    const features = {
      gameType,
      teamSize: teams[0]?.players?.length || 1,
      playerSkillLevels: teams.flatMap(team => team.players.map(() => Math.random() * 100)), // Mock skill levels
      previousMatchesCount: 5, // Mock value
      timeOfDay: new Date(startTime).getHours()
    };

    const matchParameters = await MatchAutomationService.predictMatchParameters(features);

    // Schedule match actions
    const scheduledActions = await MatchAutomationService.scheduleMatchActions(
      matchId,
      tournamentId,
      new Date(startTime),
      matchParameters.expectedDuration
    );

    // Create match automation record
    const matchAutomation = new MatchAutomation({
      tournamentId,
      matchId,
      status: 'scheduled',
      teams,
      gameType,
      startTime: new Date(startTime),
      automationSettings: automationSettings || {
        autoStart: true,
        autoEnd: true,
        resultVerification: 'ai-with-human-review',
        notifyPlayers: true
      },
      aiActions: [],
      learningData: {
        correctPredictions: 0,
        totalPredictions: 0,
        lastImprovement: new Date()
      }
    });

    await matchAutomation.save();

    return res.status(201).json({
      success: true,
      matchAutomation: {
        id: matchAutomation._id,
        tournamentId,
        matchId,
        status: matchAutomation.status,
        expectedDuration: matchParameters.expectedDuration,
        expectedScoreDifference: matchParameters.expectedScoreDifference,
        scheduledActions: scheduledActions.scheduledActions
      }
    });
  } catch (error) {
    console.error('Error creating automated match:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create automated match',
      error: error.message
    });
  }
});

/**
 * @route GET /api/matches/:matchId/automation
 * @desc Get automation details for a match
 * @access Private
 */
router.get('/:matchId/automation', async (req, res) => {
  try {
    const matchAutomation = await MatchAutomation.findOne({ matchId: req.params.matchId });
    
    if (!matchAutomation) {
      return res.status(404).json({ success: false, message: 'Match automation not found' });
    }

    return res.status(200).json({
      success: true,
      matchAutomation
    });
  } catch (error) {
    console.error('Error getting match automation:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get match automation',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/matches/:matchId/status
 * @desc Update match status
 * @access Private
 */
router.put('/:matchId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status provided' 
      });
    }

    const matchAutomation = await MatchAutomation.findOne({ matchId: req.params.matchId });
    
    if (!matchAutomation) {
      return res.status(404).json({ success: false, message: 'Match automation not found' });
    }

    // Update status
    matchAutomation.status = status;
    
    // If match is completed, set end time
    if (status === 'completed' && !matchAutomation.endTime) {
      matchAutomation.endTime = new Date();
      
      // Record AI action
      matchAutomation.aiActions.push({
        actionType: 'end',
        timestamp: new Date(),
        success: true,
        details: 'Match completed'
      });
    }

    await matchAutomation.save();

    return res.status(200).json({
      success: true,
      message: `Match status updated to ${status}`,
      matchAutomation
    });
  } catch (error) {
    console.error('Error updating match status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update match status',
      error: error.message
    });
  }
});

/**
 * @route POST /api/matches/:matchId/action
 * @desc Record an AI action for a match
 * @access Private
 */
router.post('/:matchId/action', async (req, res) => {
  try {
    const { actionType, success, details } = req.body;
    
    if (!actionType || typeof success !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const matchAutomation = await MatchAutomation.findOne({ matchId: req.params.matchId });
    
    if (!matchAutomation) {
      return res.status(404).json({ success: false, message: 'Match automation not found' });
    }

    // Add AI action
    matchAutomation.aiActions.push({
      actionType,
      timestamp: new Date(),
      success,
      details: details || ''
    });

    await matchAutomation.save();

    return res.status(200).json({
      success: true,
      message: 'AI action recorded',
      matchAutomation
    });
  } catch (error) {
    console.error('Error recording AI action:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to record AI action',
      error: error.message
    });
  }
});

export default router;
