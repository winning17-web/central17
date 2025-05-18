/**
 * Telegram Bot Server Implementation
 * 
 * This file implements the server-side logic for the Telegram bot,
 * handling webhooks, API endpoints, and integration with the mini app.
 */

const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const cors = require('cors');
const path = require('path');

// Import bot implementation
const { AIRefereeBot, AdTrackingSystem, TournamentManager } = require('./bot_implementation');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Bot token from environment or hardcoded for demo
const BOT_TOKEN = process.env.BOT_TOKEN || '7449703428:AAFJ6s8ND6BFOA2lQiRS2m_SOajqYQFzBs4';

// Initialize bot
const bot = new AIRefereeBot(BOT_TOKEN);

// Serve static files for mini app
app.use('/mini-app', express.static(path.join(__dirname, 'mini_app')));

// API Endpoints for Mini App
// These endpoints are called from the mini app's JavaScript

// Get user profile
app.get('/api/user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  
  // In a real implementation, fetch from database
  // For demo, return mock data
  res.json({
    id: userId,
    username: `user_${userId}`,
    credits: AdTrackingSystem.getUserAdCredits(userId),
    tournaments: [],
    matches: []
  });
});

// Get tournaments
app.get('/api/tournaments', (req, res) => {
  // In a real implementation, fetch from database
  // For demo, return all tournaments
  const tournaments = TournamentManager.getAllTournaments();
  res.json(tournaments);
});

// Get specific tournament
app.get('/api/tournaments/:tournamentId', (req, res) => {
  const tournamentId = req.params.tournamentId;
  const tournament = TournamentManager.getTournament(tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(tournament);
});

// Join tournament
app.post('/api/tournaments/:tournamentId/join', (req, res) => {
  const tournamentId = req.params.tournamentId;
  const userId = req.body.userId;
  
  try {
    // Check if user has enough credits
    const tournament = TournamentManager.getTournament(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const userCredits = AdTrackingSystem.getUserAdCredits(userId);
    
    if (userCredits < tournament.entryPrice) {
      return res.status(400).json({ error: 'Not enough credits' });
    }
    
    // Deduct credits and add participant
    AdTrackingSystem.deductAdCredits(userId, tournament.entryPrice);
    TournamentManager.addParticipant(tournamentId, userId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user matches
app.get('/api/matches', (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  
  // In a real implementation, fetch from database
  // For demo, filter matches for user
  const allTournaments = TournamentManager.getAllTournaments();
  const userMatches = [];
  
  allTournaments.forEach(tournament => {
    if (tournament.matches) {
      tournament.matches.forEach(match => {
        if (match.player1 === userId || match.player2 === userId) {
          userMatches.push({
            ...match,
            tournamentName: tournament.name
          });
        }
      });
    }
  });
  
  res.json(userMatches);
});

// Get specific match
app.get('/api/matches/:matchId', (req, res) => {
  const matchId = req.params.matchId;
  
  // In a real implementation, fetch from database
  // For demo, find match in tournaments
  const allTournaments = TournamentManager.getAllTournaments();
  let foundMatch = null;
  
  allTournaments.forEach(tournament => {
    if (tournament.matches) {
      const match = tournament.matches.find(m => m.id === matchId);
      if (match) {
        foundMatch = {
          ...match,
          tournamentName: tournament.name
        };
      }
    }
  });
  
  if (!foundMatch) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  res.json(foundMatch);
});

// Submit match result
app.post('/api/matches/:matchId/result', (req, res) => {
  const matchId = req.params.matchId;
  const { userId, result } = req.body;
  
  try {
    // Find match
    const allTournaments = TournamentManager.getAllTournaments();
    let foundMatch = null;
    let tournamentId = null;
    
    allTournaments.forEach(tournament => {
      if (tournament.matches) {
        const match = tournament.matches.find(m => m.id === matchId);
        if (match) {
          foundMatch = match;
          tournamentId = tournament.id;
        }
      }
    });
    
    if (!foundMatch) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    // Verify user is a participant
    if (foundMatch.player1 !== userId && foundMatch.player2 !== userId) {
      return res.status(403).json({ error: 'User is not a participant in this match' });
    }
    
    // In a real implementation, store result and notify opponent
    // For demo, just update match status
    foundMatch.status = 'completed';
    
    if (result === 'win') {
      foundMatch.result = foundMatch.player1 === userId ? 'player1' : 'player2';
    } else if (result === 'loss') {
      foundMatch.result = foundMatch.player1 === userId ? 'player2' : 'player1';
    } else {
      foundMatch.result = 'draw';
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Record ad view
app.post('/api/ad-view', (req, res) => {
  const { userId, adType } = req.body;
  
  try {
    // Record ad view
    const credits = AdTrackingSystem.recordAdWatch(parseInt(userId, 10), adType);
    
    res.json({ success: true, credits });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user credits
app.get('/api/credits/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const credits = AdTrackingSystem.getUserAdCredits(userId);
  
  res.json({ credits });
});

// Set up bot webhook
const webhookPath = '/bot';
const webhookUrl = process.env.WEBHOOK_URL || `https://your-server.com${webhookPath}`;

// Start bot with webhook or polling based on environment
if (process.env.NODE_ENV === 'production') {
  // Use webhook in production
  bot.start(webhookUrl).then(webhookCallback => {
    app.use(webhookPath, webhookCallback);
    console.log(`Bot webhook set up at ${webhookUrl}`);
  });
} else {
  // Use long polling in development
  bot.start().then(() => {
    console.log('Bot started with long polling');
  });
}

// Ad view webhook
app.post('/ad-view-webhook', (req, res) => bot.handleAdViewWebhook(req, res));

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Mini App available at: /mini-app`);
});
