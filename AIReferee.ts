/**
 * AIReferee.ts
 * 
 * AI Referee implementation for Telegram web3 game tournament mini-app
 * Integrates with Adshares for ad-based tournament entry
 */

import { Telegraf, Context } from 'telegraf';
import axios from 'axios';

// Interfaces
interface Tournament {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  entryPrice: number; // In ad credits
  maxParticipants: number;
  participants: number[];
  matches: Match[];
  status: 'created' | 'active' | 'completed' | 'cancelled';
}

interface Match {
  id: string;
  tournamentId: string;
  player1: number;
  player2: number;
  result?: 'player1' | 'player2' | 'draw';
  status: 'scheduled' | 'active' | 'completed' | 'disputed';
}

interface AdWatchRecord {
  userId: number;
  adType: string;
  timestamp: number;
  credits: number;
  verified: boolean;
}

interface GameResult {
  matchId: string;
  winnerId: number;
  loserId: number;
  score: string;
  timestamp: number;
  evidence: any;
}

// Telegram Storage Implementation
class TelegramStorage {
  // Server-side storage (replace with your database implementation)
  private static storage: Map<string, string> = new Map();
  
  // Use Telegram's CloudStorage for non-sensitive data
  static async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.CloudStorage) {
      await window.Telegram.WebApp.CloudStorage.setItem(key, value);
    } else {
      // Fallback for bot context (server-side)
      this.storage.set(key, value);
    }
  }
  
  static async getItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.CloudStorage) {
      return await window.Telegram.WebApp.CloudStorage.getItem(key);
    } else {
      // Fallback for bot context (server-side)
      return this.storage.get(key) || null;
    }
  }
  
  static async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.CloudStorage) {
      await window.Telegram.WebApp.CloudStorage.removeItem(key);
    } else {
      // Fallback for bot context (server-side)
      this.storage.delete(key);
    }
  }
  
  // For sensitive data, use SecureStorage
  static async setSecureItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.SecureStorage) {
      await window.Telegram.WebApp.SecureStorage.setItem(key, value);
    } else {
      // Fallback with encryption for server-side
      // In a real implementation, you would encrypt the data
      this.storage.set(`secure_${key}`, value);
    }
  }
  
  static async getSecureItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.SecureStorage) {
      return await window.Telegram.WebApp.SecureStorage.getItem(key);
    } else {
      // Fallback with decryption for server-side
      // In a real implementation, you would decrypt the data
      return this.storage.get(`secure_${key}`) || null;
    }
  }
}

// Ad Tracking System
class AdTrackingSystem {
  // Record a completed ad view
  static async recordAdWatch(userId: number, adType: string): Promise<number> {
    // Determine credits based on ad type
    const credits = this.getCreditsForAdType(adType);
    
    // Create record
    const record: AdWatchRecord = {
      userId,
      adType,
      timestamp: Date.now(),
      credits,
      verified: true
    };
    
    // Store record
    await this.storeAdWatchRecord(record);
    
    // Update user's total credits
    const currentCredits = await this.getUserAdCredits(userId);
    const newCredits = currentCredits + credits;
    await this.updateUserAdCredits(userId, newCredits);
    
    return newCredits;
  }
  
  // Get credits for ad type
  static getCreditsForAdType(adType: string): number {
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
  static async storeAdWatchRecord(record: AdWatchRecord): Promise<void> {
    const key = `ad_watch:${record.userId}:${record.timestamp}`;
    await TelegramStorage.setItem(key, JSON.stringify(record));
    
    // Add to user's history
    const historyKey = `ad_watch_history:${record.userId}`;
    const history = await this.getAdWatchHistory(record.userId);
    history.push(record);
    
    // Keep only last 50 records
    if (history.length > 50) {
      history.shift();
    }
    
    await TelegramStorage.setItem(historyKey, JSON.stringify(history));
  }
  
  // Get user's ad watch history
  static async getAdWatchHistory(userId: number): Promise<AdWatchRecord[]> {
    const historyKey = `ad_watch_history:${userId}`;
    const historyJson = await TelegramStorage.getItem(historyKey);
    
    if (!historyJson) {
      return [];
    }
    
    return JSON.parse(historyJson);
  }
  
  // Get user's current ad credits
  static async getUserAdCredits(userId: number): Promise<number> {
    const creditsKey = `ad_credits:${userId}`;
    const creditsJson = await TelegramStorage.getItem(creditsKey);
    
    if (!creditsJson) {
      return 0;
    }
    
    return parseInt(creditsJson, 10);
  }
  
  // Update user's ad credits
  static async updateUserAdCredits(userId: number, credits: number): Promise<void> {
    const creditsKey = `ad_credits:${userId}`;
    await TelegramStorage.setItem(creditsKey, credits.toString());
  }
  
  // Deduct ad credits (for tournament entry)
  static async deductAdCredits(userId: number, amount: number): Promise<boolean> {
    const currentCredits = await this.getUserAdCredits(userId);
    
    if (currentCredits < amount) {
      return false;
    }
    
    const newCredits = currentCredits - amount;
    await this.updateUserAdCredits(userId, newCredits);
    
    return true;
  }
}

// Tournament Manager
class TournamentManager {
  // Create a new tournament
  static async createTournament(
    name: string,
    description: string,
    startTime: Date,
    entryPrice: number,
    maxParticipants: number
  ): Promise<string> {
    const tournamentId = `tournament_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const tournament: Tournament = {
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
    
    await this.saveTournament(tournament);
    return tournamentId;
  }
  
  // Save tournament to storage
  static async saveTournament(tournament: Tournament): Promise<void> {
    await TelegramStorage.setItem(`tournament:${tournament.id}`, JSON.stringify(tournament));
    
    // Update tournament list
    const tournamentList = await this.getTournamentList();
    if (!tournamentList.includes(tournament.id)) {
      tournamentList.push(tournament.id);
      await TelegramStorage.setItem('tournament_list', JSON.stringify(tournamentList));
    }
  }
  
  // Get tournament by ID
  static async getTournament(tournamentId: string): Promise<Tournament | null> {
    const tournamentJson = await TelegramStorage.getItem(`tournament:${tournamentId}`);
    
    if (!tournamentJson) {
      return null;
    }
    
    return JSON.parse(tournamentJson);
  }
  
  // Get list of all tournament IDs
  static async getTournamentList(): Promise<string[]> {
    const listJson = await TelegramStorage.getItem('tournament_list');
    
    if (!listJson) {
      return [];
    }
    
    return JSON.parse(listJson);
  }
  
  // Get tournament entry price
  static async getTournamentEntryPrice(tournamentId: string): Promise<number> {
    const tournament = await this.getTournament(tournamentId);
    
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    
    return tournament.entryPrice;
  }
  
  // Add participant to tournament
  static async addParticipant(tournamentId: string, userId: number): Promise<boolean> {
    const tournament = await this.getTournament(tournamentId);
    
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
    await this.saveTournament(tournament);
    
    return true;
  }
  
  // Start tournament
  static async startTournament(tournamentId: string): Promise<boolean> {
    const tournament = await this.getTournament(tournamentId);
    
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
    
    await this.saveTournament(tournament);
    
    return true;
  }
  
  // Generate matches for tournament
  static generateMatches(tournament: Tournament): Match[] {
    const matches: Match[] = [];
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
}

// Game Rules Engine
class GameRulesEngine {
  // Validate game result
  static async validateResult(matchId: string, result: GameResult): Promise<boolean> {
    // Get match details
    const match = await this.getMatch(matchId);
    
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    
    // Verify players
    if (result.winnerId !== match.player1 && result.winnerId !== match.player2) {
      return false;
    }
    
    if (result.loserId !== match.player1 && result.loserId !== match.player2) {
      return false;
    }
    
    // Verify evidence (screenshots, game logs, etc.)
    const evidenceValid = await this.verifyEvidence(result.evidence);
    
    return evidenceValid;
  }
  
  // Get match by ID
  static async getMatch(matchId: string): Promise<Match | null> {
    const matchJson = await TelegramStorage.getItem(`match:${matchId}`);
    
    if (!matchJson) {
      return null;
    }
    
    return JSON.parse(matchJson);
  }
  
  // Verify evidence
  static async verifyEvidence(evidence: any): Promise<boolean> {
    // In a real implementation, this would analyze screenshots, game logs, etc.
    // For now, we'll just return true
    return true;
  }
  
  // Update match result
  static async updateMatchResult(
    matchId: string,
    result: 'player1' | 'player2' | 'draw'
  ): Promise<boolean> {
    const match = await this.getMatch(matchId);
    
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    
    match.result = result;
    match.status = 'completed';
    
    await TelegramStorage.setItem(`match:${matchId}`, JSON.stringify(match));
    
    return true;
  }
}

// AI Referee Bot
export class AIRefereeBot {
  private bot: Telegraf;
  
  constructor(token: string) {
    this.bot = new Telegraf(token);
    
    this.setupCommands();
    this.setupCallbacks();
    this.setupMiddleware();
  }
  
  private setupCommands(): void {
    // Tournament management commands
    this.bot.command('create_tournament', this.createTournament.bind(this));
    this.bot.command('join_tournament', this.joinTournament.bind(this));
    this.bot.command('start_tournament', this.startTournament.bind(this));
    this.bot.command('end_tournament', this.endTournament.bind(this));
    
    // Ad-based entry commands
    this.bot.command('watch_ads', this.watchAds.bind(this));
    this.bot.command('check_ad_credits', this.checkAdCredits.bind(this));
    
    // Game validation commands
    this.bot.command('submit_result', this.submitResult.bind(this));
    this.bot.command('dispute_result', this.disputeResult.bind(this));
    
    // Help and info commands
    this.bot.command('help', this.showHelp.bind(this));
    this.bot.command('rules', this.showRules.bind(this));
    
    // Start command
    this.bot.start(this.handleStart.bind(this));
  }
  
  private setupCallbacks(): void {
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
  
  private setupMiddleware(): void {
    // Add middleware for user authentication
    this.bot.use(async (ctx, next) => {
      // Verify user identity
      const userId = ctx.from?.id;
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Store user data in context for later use
      ctx.state.userId = userId;
      ctx.state.username = ctx.from?.username || `user_${userId}`;
      
      await next();
    });
  }
  
  // Handle /start command
  private async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || `user_${userId}`;
    
    await ctx.reply(
      `Welcome to the Web3 Game Tournament Bot, ${username}!\n\n` +
      `This bot helps you participate in game tournaments using ad credits.\n\n` +
      `Use /help to see available commands.`
    );
  }
  
  // Tournament management methods
  private async createTournament(ctx: Context): Promise<void> {
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
      const tournamentId = await TournamentManager.createTournament(
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
  
  private async joinTournament(ctx: Context): Promise<void> {
    const message = ctx.message?.text || '';
    const tournamentId = message.split(' ')[1];
    
    if (!tournamentId) {
      return ctx.reply('Please provide a tournament ID: /join_tournament TOURNAMENT_ID');
    }
    
    try {
      const tournament = await TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      const userId = ctx.from?.id;
      
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Check if user has enough ad credits
      const adCredits = await AdTrackingSystem.getUserAdCredits(userId);
      
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
  
  private async handleJoinTournament(ctx: Context, tournamentId: string): Promise<void> {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    try {
      const tournament = await TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      // Deduct ad credits
      const success = await AdTrackingSystem.deductAdCredits(userId, tournament.entryPrice);
      
      if (!success) {
        return ctx.reply(
          `Failed to deduct ad credits. Please check your balance and try again.`
        );
      }
      
      // Add participant to tournament
      await TournamentManager.addParticipant(tournamentId, userId);
      
      await ctx.reply(
        `You have successfully joined tournament "${tournament.name}"!\n\n` +
        `${tournament.entryPrice} ad credits have been deducted from your balance.`
      );
    } catch (error) {
      await ctx.reply(`Error joining tournament: ${error.message}`);
    }
  }
  
  private async startTournament(ctx: Context): Promise<void> {
    const message = ctx.message?.text || '';
    const tournamentId = message.split(' ')[1];
    
    if (!tournamentId) {
      return ctx.reply('Please provide a tournament ID: /start_tournament TOURNAMENT_ID');
    }
    
    try {
      const tournament = await TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      // Only allow creator to start tournament
      // In a real implementation, you would check if the user is the creator
      
      await TournamentManager.startTournament(tournamentId);
      
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
  
  private async endTournament(ctx: Context): Promise<void> {
    const message = ctx.message?.text || '';
    const tournamentId = message.split(' ')[1];
    
    if (!tournamentId) {
      return ctx.reply('Please provide a tournament ID: /end_tournament TOURNAMENT_ID');
    }
    
    try {
      const tournament = await TournamentManager.getTournament(tournamentId);
      
      if (!tournament) {
        return ctx.reply(`Tournament ${tournamentId} not found.`);
      }
      
      // Only allow creator to end tournament
      // In a real implementation, you would check if the user is the creator
      
      tournament.status = 'completed';
      await TournamentManager.saveTournament(tournament);
      
      await ctx.reply(
        `Tournament "${tournament.name}" has been completed!\n\n` +
        `Results will be announced soon.`
      );
    } catch (error) {
      await ctx.reply(`Error ending tournament: ${error.message}`);
    }
  }
  
  // Ad watching and tracking methods
  private async watchAds(ctx: Context): Promise<void> {
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
  
  private async handleWatchAd(ctx: Context, adType: string): Promise<void> {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    // Generate deep link to mini-app with ad viewing parameters
    const adViewingLink = `https://t.me/your_bot?startapp=watch_ad_${adType}_${userId}`;
    
    await ctx.reply(
      `Click the button below to watch an ad and earn credits:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Watch Ad Now', url: adViewingLink }]
          ]
        }
      }
    );
  }
  
  private async checkAdCredits(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return ctx.reply('Unable to identify user.');
    }
    
    const adCredits = await AdTrackingSystem.getUserAdCredits(userId);
    
    await ctx.reply(`You currently have ${adCredits} ad credits.`);
  }
  
  // Game validation methods
  private async submitResult(ctx: Context): Promise<void> {
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
      const match = await GameRulesEngine.getMatch(matchId);
      
      if (!match) {
        return ctx.reply(`Match ${matchId} not found.`);
      }
      
      const userId = ctx.from?.id;
      
      if (!userId) {
        return ctx.reply('Unable to identify user.');
      }
      
      // Determine result based on player and result type
      let result: 'player1' | 'player2' | 'draw';
      
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
  
  private async disputeResult(ctx: Context): Promise<void> {
    const message = ctx.message?.text || '';
    const matchId = message.split(' ')[1];
    
    if (!matchId) {
      return ctx.reply('Please provide a match ID: /dispute_result MATCH_ID');
    }
    
    await ctx.reply(
      `You have disputed the result for match ${matchId}.\n\n` +
      `Please provide evidence (screenshots, game logs, etc.) to support your claim.`
    );
    
    // In a real implementation, you would collect evidence and use AI to resolve the dispute
  }
  
  private async handleConfirmResult(ctx: Context, matchId: string, result: string): Promise<void> {
    try {
      // Update match result
      await GameRulesEngine.updateMatchResult(
        matchId,
        result as 'player1' | 'player2' | 'draw'
      );
      
      await ctx.reply(
        `You have confirmed the result for match ${matchId}.\n\n` +
        `The result has been recorded.`
      );
    } catch (error) {
      await ctx.reply(`Error confirming result: ${error.message}`);
    }
  }
  
  // Help and info methods
  private async showHelp(ctx: Context): Promise<void> {
    await ctx.reply(
      `Available commands:\n\n` +
      `Tournament Management:\n` +
      `/create_tournament - Create a new tournament\n` +
      `/join_tournament - Join an existing tournament\n` +
      `/start_tournament - Start a tournament\n` +
      `/end_tournament - End a tournament\n\n` +
      `Ad Credits:\n` +
      `/watch_ads - Watch ads to earn credits\n` +
      `/check_ad_credits - Check your ad credit balance\n\n` +
      `Game Results:\n` +
      `/submit_result - Submit a match result\n` +
      `/dispute_result - Dispute a match result\n\n` +
      `Other:\n` +
      `/help - Show this help message\n` +
      `/rules - Show tournament rules`
    );
  }
  
  private async showRules(ctx: Context): Promise<void> {
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
  async handleAdViewWebhook(req: any, res: any): Promise<void> {
    try {
      const { userId, adType, timestamp, signature } = req.body;
      
      // Verify signature (in a real implementation)
      // const isValid = this.verifySignature(req.body, signature);
      const isValid = true; // For demonstration
      
      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }
      
      // Record ad view
      const credits = await AdTrackingSystem.recordAdWatch(
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
  async start(webhookUrl?: string): Promise<void> {
    if (webhookUrl) {
      // Use webhook
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log(`Bot webhook set to ${webhookUrl}`);
    } else {
      // Use long polling
      await this.bot.launch();
      console.log('Bot started with long polling');
    }
  }
  
  // Get webhook callback
  getWebhookCallback(): any {
    return this.bot.webhookCallback('/bot');
  }
  
  // Stop the bot
  async stop(): Promise<void> {
    await this.bot.stop();
  }
}

// Export additional classes for use in other files
export { AdTrackingSystem, TournamentManager, GameRulesEngine, TelegramStorage };
