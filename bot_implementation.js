/**
 * Telegram Bot Implementation for Web3 Game Tournament Mini-App
 * 
 * This file implements a functional Telegram bot that integrates with the AI referee
 * system and provides tournament management with ad-based entry.
 */

const { Telegraf } = require('telegraf');
const express = require('express');
const bodyParser = require('body-parser');

// Initialize database (in a production environment, use a proper database)
const db = {
  users: new Map(),
  tournaments: new Map(),
  matches: new Map(),
  adCredits: new Map()
};

/**
 * Ad Tracking System
 * Handles ad view tracking and credit management
 */
class AdTrackingSystem {
  // Record a completed ad view
  static recordAdWatch(userId, adType) {
    // Determine credits based on ad type
    const credits = this.getCreditsForAdType(adType);
    
    // Create record
    const record = {
      userId,
      adType,
      timestamp: Date.now(),
      credits,
      verified: true
    };
    
    // Store record
    this.storeAdWatchRecord(record);
    
    // Update user's total credits
    const currentCredits = this.getUserAdCredits(userId);
    const newCredits = currentCredits + credits;
    this.updateUserAdCredits(userId, newCredits);
    
    return newCredits;
  }
  
  // Get credits for ad type
  static getCreditsForAdType(adType) {
    switch (adType) {
      case 'short':
        return 5;
      case 'medium':
        return 10;
      case 'long':
        return 20;
      default:
        return 1;
    }
  }
  
  // Store ad watch record
  static storeAdWatchRecord(record) {
    const key = `ad_watch:${record.userId}:${record.timestamp}`;
    const userRecords = db.users.get(record.userId) || { adWatchHistory: [] };
    
    userRecords.adWatchHistory = userRecords.adWatchHistory || [];
    userRecords.adWatchHistory.push(record);
    
    // Keep only last 50 records
    if (userRecords.adWatchHistory.length > 50) {
      userRecords.adWatchHistory.shift();
    }
    
    db.users.set(record.userId, userRecords);
  }
  
  // Get user's ad watch history
  static getAdWatchHistory(userId) {
    const userRecords = db.users.get(userId) || { adWatchHistory: [] };
    return userRecords.adWatchHistory || [];
  }
  
  // Get user's current ad credits
  static getUserAdCredits(userId) {
    return db.adCredits.get(userId) || 0;
  }
  
  // Update user's ad credits
  static updateUserAdCredits(userId, credits) {
    db.adCredits.set(userId, credits);
  }
  
  // Deduct ad credits (for tournament entry)
  static deductAdCredits(userId, amount) {
    const currentCredits = this.getUserAdCredits(userId);
    
    if (currentCredits < amount) {
      return false;
    }
    
    const newCredits = currentCredits - amount;
    this.updateUserAdCredits(userId, newCredits);
    
    return true;
  }
}

/**
 * Tournament Manager
 * Handles tournament creation, management, and participant registration
 */
class TournamentManager {
  // Create a new tournament
  static createTournament(name, description, startTime, entryPrice, maxParticipants) {
    const tournamentId = `tournament_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const tournament = {
      id: tournamentId,
      name,
      description,
      startTime,
      entryPrice, // In ad credits
      maxParticipants,
      participants: [],
      matches: [],
      status: 'created'
    };
    
    db.tournaments.set(tournamentId, tournament);
    return tournamentId;
  }
  
  // Get tournament by ID
  static getTournament(tournamentId) {
    return db.tournaments.get(tournamentId) || null;
  }
  
  // Get list of all tournaments
  static getAllTournaments() {
    return Array.from(db.tournaments.values());
  }
  
  // Get tournament entry price
  static getTournamentEntryPrice(tournamentId) {
    const tournament = this.getTournament(tournamentId);
    
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    
    return tournament.entryPrice;
  }
  
  // Add participant to tournament
  static addParticipant(tournamentId, userId) {
    const tournament = this.getTournament(tournamentId);
    
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    
    if (tournament.status !== 'created') {
      throw new Error(`Tournament ${tournamentId} is not open for registration`);
    }
    
    if (tournament.participants.length >= tournament.maxParticipants) {
      throw new Error(`Tournament ${tournamentId} is full`);
    }
    
    if (tournament.participants.includes(userId)) {
      throw new Error(`User ${userId} is already registered for tournament ${tournamentId}`);
    }
    
    tournament.participants.push(userId);
    db.tournaments.set(tournamentId, tournament);
    
    return true;
  }
  
  // Start tournament
  static startTournament(tournamentId) {
    const tournament = this.getTournament(tournamentId);
    
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    
    if (tournament.status !== 'created') {
      throw new Error(`Tournament ${tournamentId} cannot be started`);
    }
    
    if (tournament.participants.length < 2) {
      throw new Error(`Tournament ${tournamentId} needs at least 2 participants`);
    }
    
    tournament.status = 'active';
    tournament.matches = this.generateMatches(tournament);
    
    db.tournaments.set(tournamentId, tournament);
    
    // Store matches in database
    for (const match of tournament.matches) {
      db.matches.set(match.id, match);
    }
    
    return true;
  }
  
  // Generate matches for tournament
  static generateMatches(tournament) {
    const matches = [];
    const participants = [...tournament.participants];
    
    // Simple round-robin tournament
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const matchId = `match_${tournament.id}_${i}_${j}_${Date.now()}`;
        
        matches.push({
          id: matchId,
          tournamentId: tournament.id,
          player1: participants[i],
          player2: participants[j],
          status: 'scheduled'
        });
      }
    }
    
    return matches;
  }
  
  // Get match by ID
  static getMatch(matchId) {
    return db.matches.get(matchId) || null;
  }
  
  // Update match result
  static updateMatchResult(matchId, result) {
    const match = this.getMatch(matchId);
    
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    
    match.result = result;
    match.status = 'completed';
    
    db.matches.set(matchId, match);
    
    return true;
  }
}

/**
 * AI Referee Bot
 * Main bot implementation for Telegram
 */
class AIRefereeBot {
  constructor(token) {
    this.bot = new Telegraf(token);
    this.setupCommands();
    this.setupCallbacks();
    this.setupMiddleware();
  }
  
  setupCommands() {
    // Tournament management commands
    this.bot.command('create_tournament', this.createTournament.bind(this));
    this.bot.command('join_tournament', this.joinTournament.bind(this));
    this.bot.command('start_tournament', this.startTournament.bind(this));
    this.bot.command('list_tournaments', this.listTournaments.bind(this));
    
    // Ad-based entry commands
    this.bot.command('watch_ads', this.watchAds.bind(this));
    this.bot.command('check_credits', this.checkAdCredits.bind(this));
    
    // Game validation commands
    this.bot.command('submit_result', this.submitResult.bind(this));
    
    // Help and info commands
    this.bot.command('help', this.showHelp.bind(this));
    this.bot.command('rules', this.showRules.bind(this));
    
    // Start command
    this.bot.start(this.handleStart.bind(this));
  }
  
  setupCallbacks() {
    // Handle inline keyboard callbacks
    this.bot.on('callback_query', async (ctx) => {
      const callbackData = ctx.callbackQuery.data;
      
      if (callbackData.startsWith('join_tournament:')) {
        const tournamentId = callbackData.split(':')[1];
        await this.handleJoinTournament(ctx, tournamentId);
      } else if (callbackData.startsWith('confirm_result:')) {
        const [, matchId, result] = callbackData.split(':');
        await this.handleConfirmResult(ctx, matchId, result);
      } else if (callbackData.startsWith('watch_ad:')) {
        const adType = callbackData.split(':')[1];
        await this.handleWatchAd(ctx, adType);
      }
    });
  }
  
  setupMiddleware() {
    // Add middleware for user authentication
    this.bot.use(async (ctx, next) => {
      // Verify user identity
      const userId = ctx.from?.id;
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Store user data in context for later use
      ctx.state = ctx.state || {};
      ctx.state.userId = userId;
      ctx.state.username = ctx.from?.username || `user_${userId}`;
      
      // Initialize user in database if not exists
      if (!db.users.has(userId)) {
        db.users.set(userId, {
          id: userId,
          username: ctx.state.username,
          adWatchHistory: []
        });
      }
      
      await next();
    });
  }
  
  // Handle /start command
  async handleStart(ctx) {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || `user_${userId}`;
    
    // Check if start parameter contains ad viewing info
    const startParam = ctx.startPayload;
    
    if (startParam && startParam.startsWith('watch_ad_')) {
      const parts = startParam.split('_');
      const adType = parts[2];
      
      // Record ad view
      const credits = AdTrackingSystem.recordAdWatch(userId, adType);
      
      await ctx.reply(
        `Thank you for watching the ad!\n\n` +
        `You earned ${AdTrackingSystem.getCreditsForAdType(adType)} credits.\n` +
        `Your new balance: ${credits} credits.`
      );
      
      return;
    }
    
    await ctx.reply(
      `Welcome to the Web3 Game Tournament Bot, ${username}!\n\n` +
      `This bot helps you participate in game tournaments using ad credits.\n\n` +
      `Use /help to see available commands.`
    );
  }
  
  // Tournament management methods
  async createTournament(ctx) {
    // Extract command parameters
    const message = ctx.message?.text || '';
    const params = message.split(' ').slice(1).join(' ').split(',');
    
    if (params.length < 4) {
      return ctx.reply(
        'Please provide tournament details in the format:\n' +
        '/create_tournament Name, Description, Entry Price, Max Participants'
      );
    }
    
    const name = params[0].trim();
    const description = params[1].trim();
    const entryPrice = parseInt(params[2].trim(), 10);
    const maxParticipants = parseInt(params[3].trim(), 10);
    
    if (isNaN(entryPrice) || isNaN(maxParticipants)) {
      return ctx.reply('Entry price and max participants must be numbers.');
    }
    
    try {
      const tournamentId = TournamentManager.createTournament(
        name,
        description,
        new Date(Date.now() + 24 * 60 * 60 * 1000), // Start in 24 hours
        entryPrice,
        maxParticipants
      );
      
      await ctx.reply(
        `Tournament created successfully!\n\n` +
        `Name: ${name}\n` +
        `Description: ${description}\n` +
        `Entry Price: ${entryPrice} ad credits\n` +
        `Max Participants: ${maxParticipants}\n\n` +
        `Tournament ID: ${tournamentId}\n\n` +
        `Players can join using /join_tournament ${tournamentId}`
      );
    } catch (error) {
      await ctx.reply(`Error creating tournament: ${error.message}`);
    }
  }
  
  async listTournaments(ctx) {
    const tournaments = TournamentManager.getAllTournaments();
    
    if (tournaments.length === 0) {
      return ctx.reply('No tournaments found.');
    }
    
    let message = 'Available Tournaments:\n\n';
    
    for (const tournament of tournaments) {
      message += `ID: ${tournament.id}\n` +
                 `Name: ${tournament.name}\n` +
                 `Status: ${tournament.status}\n` +
                 `Entry Price: ${tournament.entryPrice} credits\n` +
                 `Participants: ${tournament.participants.length}/${tournament.maxParticipants}\n\n`;
    }
    
    message += 'Use /join_tournament ID to join a tournament.';
    
    await ctx.reply(message);
  }
  
  async joinTournament(ctx) {
    const message = ctx.message?.text || '';
    const tournamentId = message.split(' ')[1];
    
    if (!tournamentId) {
      return ctx.reply('Please provide a tournament ID: /join_tournament TOURNAMENT_ID');
    }
    
    try {
      const tournament = TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      const userId = ctx.from?.id;
      
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Check if user has enough ad credits
      const adCredits = AdTrackingSystem.getUserAdCredits(userId);
      
      if (adCredits < tournament.entryPrice) {
        return ctx.reply(
          `You don't have enough ad credits to join this tournament.\n\n` +
          `Required: ${tournament.entryPrice} credits\n` +
          `Your balance: ${adCredits} credits\n\n` +
          `Use /watch_ads to earn more credits.`
        );
      }
      
      // Show confirmation button
      await ctx.reply(
        `You are about to join tournament "${tournament.name}".\n\n` +
        `Entry fee: ${tournament.entryPrice} ad credits\n` +
        `Your balance: ${adCredits} credits\n\n` +
        `Do you want to proceed?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Join Tournament', callback_data: `join_tournament:${tournamentId}` }]
            ]
          }
        }
      );
    } catch (error) {
      await ctx.reply(`Error joining tournament: ${error.message}`);
    }
  }
  
  async handleJoinTournament(ctx, tournamentId) {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    try {
      const tournament = TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      // Deduct ad credits
      const success = AdTrackingSystem.deductAdCredits(userId, tournament.entryPrice);
      
      if (!success) {
        return ctx.reply(
          `Failed to deduct ad credits. Please check your balance and try again.`
        );
      }
      
      // Add participant to tournament
      TournamentManager.addParticipant(tournamentId, userId);
      
      await ctx.reply(
        `You have successfully joined tournament "${tournament.name}"!\n\n` +
        `${tournament.entryPrice} ad credits have been deducted from your balance.`
      );
    } catch (error) {
      await ctx.reply(`Error joining tournament: ${error.message}`);
    }
  }
  
  async startTournament(ctx) {
    const message = ctx.message?.text || '';
    const tournamentId = message.split(' ')[1];
    
    if (!tournamentId) {
      return ctx.reply('Please provide a tournament ID: /start_tournament TOURNAMENT_ID');
    }
    
    try {
      const tournament = TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      // Only allow creator to start tournament
      // In a real implementation, you would check if the user is the creator
      
      TournamentManager.startTournament(tournamentId);
      
      await ctx.reply(
        `Tournament "${tournament.name}" has been started!\n\n` +
        `${tournament.participants.length} participants are competing.`
      );
      
      // Notify all participants
      for (const participantId of tournament.participants) {
        try {
          await this.bot.telegram.sendMessage(
            participantId,
            `Tournament "${tournament.name}" has started!\n\n` +
            `Good luck and have fun!`
          );
        } catch (error) {
          console.error(`Failed to notify participant ${participantId}:`, error);
        }
      }
    } catch (error) {
      await ctx.reply(`Error starting tournament: ${error.message}`);
    }
  }
  
  // Ad watching and tracking methods
  async watchAds(ctx) {
    // Present ad watching options to user
    await ctx.reply(
      'Choose an ad type to watch:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Short Ad (5 credits)', callback_data: 'watch_ad:short' }],
            [{ text: 'Medium Ad (10 credits)', callback_data: 'watch_ad:medium' }],
            [{ text: 'Long Ad (20 credits)', callback_data: 'watch_ad:long' }]
          ]
        }
      }
    );
  }
  
  async handleWatchAd(ctx, adType) {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    // Generate deep link to mini-app with ad viewing parameters
    const botUsername = (await this.bot.telegram.getMe()).username;
    const adViewingLink = `https://t.me/${botUsername}?start=watch_ad_${adType}_${userId}`;
    
    // Generate mini-app link
    const miniAppUrl = `https://t.me/${botUsername}/app?startapp=watch_ad_${adType}_${userId}`;
    
    await ctx.reply(
      `Click one of the buttons below to watch an ad and earn credits:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Watch Ad in Bot', url: adViewingLink }],
            [{ text: 'Watch Ad in Mini App', url: miniAppUrl }]
          ]
        }
      }
    );
  }
  
  async checkAdCredits(ctx) {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    const adCredits = AdTrackingSystem.getUserAdCredits(userId);
    
    await ctx.reply(`You currently have ${adCredits} ad credits.`);
  }
  
  // Game validation methods
  async submitResult(ctx) {
    const message = ctx.message?.text || '';
    const parts = message.split(' ');
    
    if (parts.length < 3) {
      return ctx.reply(
        'Please provide match details:\n' +
        '/submit_result MATCH_ID RESULT\n\n' +
        'Example: /submit_result match_123 win'
      );
    }
    
    const matchId = parts[1];
    const resultType = parts[2].toLowerCase();
    
    if (!['win', 'loss', 'draw'].includes(resultType)) {
      return ctx.reply('Result must be one of: win, loss, draw');
    }
    
    try {
      const match = TournamentManager.getMatch(matchId);
      
      if (!match) {
        return ctx.reply(`Match ${matchId} not found.`);
      }
      
      const userId = ctx.from?.id;
      
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Determine result based on player and result type
      let result;
      
      if (resultType === 'draw') {
        result = 'draw';
      } else if (userId === match.player1) {
        result = resultType === 'win' ? 'player1' : 'player2';
      } else if (userId === match.player2) {
        result = resultType === 'win' ? 'player2' : 'player1';
      } else {
        return ctx.reply('You are not a participant in this match.');
      }
      
      // Ask opponent to confirm
      const opponentId = userId === match.player1 ? match.player2 : match.player1;
      
      await this.bot.telegram.sendMessage(
        opponentId,
        `Your opponent has submitted a result for match ${matchId}:\n\n` +
        `Result: ${resultType === 'draw' ? 'Draw' : (resultType === 'win' ? 'You lost' : 'You won')}\n\n` +
        `Do you confirm this result?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Confirm', callback_data: `confirm_result:${matchId}:${result}` }],
              [{ text: 'Dispute', callback_data: `dispute_result:${matchId}` }]
            ]
          }
        }
      );
      
      await ctx.reply(
        `Your result has been submitted. Waiting for opponent confirmation.`
      );
    } catch (error) {
      await ctx.reply(`Error submitting result: ${error.message}`);
    }
  }
  
  async handleConfirmResult(ctx, matchId, result) {
    try {
      // Update match result
      TournamentManager.updateMatchResult(matchId, result);
      
      await ctx.reply(
        `You have confirmed the result for match ${matchId}.\n\n` +
        `The result has been recorded.`
      );
    } catch (error) {
      await ctx.reply(`Error confirming result: ${error.message}`);
    }
  }
  
  // Help and info methods
  async showHelp(ctx) {
    await ctx.reply(
      `Available commands:\n\n` +
      `Tournament Management:\n` +
      `/create_tournament - Create a new tournament\n` +
      `/join_tournament - Join an existing tournament\n` +
      `/start_tournament - Start a tournament\n` +
      `/list_tournaments - List all tournaments\n\n` +
      `Ad Credits:\n` +
      `/watch_ads - Watch ads to earn credits\n` +
      `/check_credits - Check your ad credit balance\n\n` +
      `Game Results:\n` +
      `/submit_result - Submit a match result\n\n` +
      `Other:\n` +
      `/help - Show this help message\n` +
      `/rules - Show tournament rules`
    );
  }
  
  async showRules(ctx) {
    await ctx.reply(
      `Tournament Rules:\n\n` +
      `1. Players must earn ad credits by watching ads\n` +
      `2. Tournament entry requires a specific number of ad credits\n` +
      `3. All match results must be confirmed by both players\n` +
      `4. Disputed results will be resolved by the AI referee\n` +
      `5. Tournament winners receive rewards based on their performance`
    );
  }
  
  // Webhook handler for ad view verification
  async handleAdViewWebhook(req, res) {
    try {
      const { userId, adType, timestamp, signature } = req.body;
      
      // Verify signature (in a real implementation)
      // const isValid = this.verifySignature(req.body, signature);
      const isValid = true; // For demonstration
      
      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }
      
      // Record ad view
      const credits = AdTrackingSystem.recordAdWatch(
        parseInt(userId, 10),
        adType
      );
      
      res.status(200).json({ success: true, credits });
    } catch (error) {
      console.error('Error processing ad view webhook:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
  
  // Start the bot
  async start(webhookUrl) {
    if (webhookUrl) {
      // Use webhook
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log(`Bot webhook set to ${webhookUrl}`);
      return this.bot.webhookCallback('/bot');
    } else {
      // Use long polling
      await this.bot.launch();
      console.log('Bot started with long polling');
      
      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
  }
}

/**
 * Express server for bot webhook and mini-app hosting
 */
function createServer(botToken) {
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Parse JSON bodies
  app.use(bodyParser.json());
  
  // Create bot instance
  const bot = new AIRefereeBot(botToken);
  
  // Set up webhook
  const webhookPath = '/bot';
  const webhookCallback = bot.start(`https://your-server.com${webhookPath}`);
  app.use(webhookPath, webhookCallback);
  
  // Ad view webhook
  app.post('/ad-view', (req, res) => bot.handleAdViewWebhook(req, res));
  
  // Serve mini-app static files
  app.use(express.static('public'));
  
  // Start server
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  
  return app;
}

// Main entry point
if (require.main === module) {
  const botToken = process.env.BOT_TOKEN || '7449703428:AAFJ6s8ND6BFOA2lQiRS2m_SOajqYQFzBs4';
  
  if (!botToken) {
    console.error('BOT_TOKEN environment variable is required');
    process.exit(1);
  }
  
  createServer(botToken);
}

module.exports = {
  AIRefereeBot,
  AdTrackingSystem,
  TournamentManager,
  createServer
};
