/**
 * Dynamic NFT Service
 * 
 * This module implements dynamic NFT tickets that evolve based on player performance,
 * tournament participation, and PlayCoin usage.
 */

import mongoose from 'mongoose';
import { ethers } from 'ethers';

// Interfaces
export interface IDynamicNFT {
  _id: string;
  tokenId: number;
  owner: string;
  tournamentId: string;
  baseURI: string;
  currentLevel: number;
  experience: number;
  attributes: {
    performance: number;
    participation: number;
    loyalty: number;
    rarity: number;
    specialAbilities: string[];
  };
  visualElements: {
    baseImage: string;
    overlays: string[];
    animations: string[];
    colorScheme: string;
  };
  history: {
    timestamp: Date;
    event: string;
    previousLevel?: number;
    newLevel?: number;
    experienceGained?: number;
    attributesChanged?: string[];
    visualElementsChanged?: string[];
  }[];
  lastUpdated: Date;
  createdAt: Date;
}

// MongoDB Schema Definition
const DynamicNFTSchema = new mongoose.Schema({
  tokenId: { type: Number, required: true, unique: true },
  owner: { type: String, required: true },
  tournamentId: { type: String, required: true },
  baseURI: { type: String, required: true },
  currentLevel: { type: Number, required: true, default: 1 },
  experience: { type: Number, required: true, default: 0 },
  attributes: {
    performance: { type: Number, required: true, default: 50 },
    participation: { type: Number, required: true, default: 50 },
    loyalty: { type: Number, required: true, default: 50 },
    rarity: { type: Number, required: true, default: 1 },
    specialAbilities: { type: [String], default: [] }
  },
  visualElements: {
    baseImage: { type: String, required: true },
    overlays: { type: [String], default: [] },
    animations: { type: [String], default: [] },
    colorScheme: { type: String, default: 'default' }
  },
  history: [{
    timestamp: { type: Date, default: Date.now },
    event: { type: String, required: true },
    previousLevel: { type: Number },
    newLevel: { type: Number },
    experienceGained: { type: Number },
    attributesChanged: { type: [String] },
    visualElementsChanged: { type: [String] }
  }],
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Create model if it doesn't exist
let DynamicNFT: mongoose.Model<IDynamicNFT & mongoose.Document>;

try {
  DynamicNFT = mongoose.model<IDynamicNFT & mongoose.Document>('DynamicNFT');
} catch {
  DynamicNFT = mongoose.model<IDynamicNFT & mongoose.Document>('DynamicNFT', DynamicNFTSchema);
}

// Smart Contract ABI for PlayPlusTicket
const PLAY_PLUS_TICKET_ABI = [
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function updateTokenURI(uint256 tokenId, string memory uri) public onlyOwner",
  "function safeMint(address to, string memory uri) public onlyOwner returns (uint256)"
];

/**
 * Dynamic NFT Service Implementation
 */
class DynamicNFTService {
  private contractAddress: string;
  private provider: ethers.providers.Provider;
  
  constructor(contractAddress: string, provider: ethers.providers.Provider) {
    this.contractAddress = contractAddress;
    this.provider = provider;
  }
  
  /**
   * Create a new dynamic NFT
   */
  async createDynamicNFT(
    owner: string,
    tournamentId: string,
    initialAttributes: {
      rarity: number;
      specialAbilities?: string[];
    } = { rarity: 1 }
  ): Promise<{
    tokenId: number;
    nft: IDynamicNFT;
    transactionHash?: string;
  }> {
    try {
      // Generate base image and URI based on tournament and attributes
      const baseImage = await this.generateBaseImage(tournamentId, initialAttributes.rarity);
      const baseURI = await this.generateMetadataURI(tournamentId, initialAttributes.rarity);
      
      // Connect to contract with admin signer
      const signer = this.provider.getSigner();
      const contract = new ethers.Contract(
        this.contractAddress,
        PLAY_PLUS_TICKET_ABI,
        signer
      );
      
      // Mint NFT on-chain
      const tx = await contract.safeMint(owner, baseURI);
      const receipt = await tx.wait();
      
      // Extract token ID from event logs
      const event = receipt.events?.find(e => e.event === 'Transfer');
      if (!event || !event.args) {
        throw new Error('Failed to extract token ID from mint transaction');
      }
      
      const tokenId = event.args.tokenId.toNumber();
      const transactionHash = receipt.transactionHash;
      
      // Create dynamic NFT in database
      const nft = await DynamicNFT.create({
        tokenId,
        owner,
        tournamentId,
        baseURI,
        currentLevel: 1,
        experience: 0,
        attributes: {
          performance: 50,
          participation: 50,
          loyalty: 50,
          rarity: initialAttributes.rarity || 1,
          specialAbilities: initialAttributes.specialAbilities || []
        },
        visualElements: {
          baseImage,
          overlays: [],
          animations: [],
          colorScheme: 'default'
        },
        history: [{
          timestamp: new Date(),
          event: 'created',
        }]
      });
      
      return { tokenId, nft, transactionHash };
    } catch (error) {
      console.error('Error creating dynamic NFT:', error);
      throw error;
    }
  }
  
  /**
   * Get dynamic NFT by token ID
   */
  async getDynamicNFT(tokenId: number): Promise<IDynamicNFT> {
    const nft = await DynamicNFT.findOne({ tokenId });
    if (!nft) {
      throw new Error(`Dynamic NFT with token ID ${tokenId} not found`);
    }
    return nft;
  }
  
  /**
   * Get all dynamic NFTs owned by a user
   */
  async getUserNFTs(owner: string): Promise<IDynamicNFT[]> {
    return DynamicNFT.find({ owner });
  }
  
  /**
   * Add experience to a dynamic NFT
   */
  async addExperience(
    tokenId: number,
    experiencePoints: number,
    source: string
  ): Promise<{
    previousLevel: number;
    newLevel: number;
    leveledUp: boolean;
    updatedNFT: IDynamicNFT;
    transactionHash?: string;
  }> {
    try {
      const nft = await this.getDynamicNFT(tokenId);
      const previousLevel = nft.currentLevel;
      
      // Add experience
      nft.experience += experiencePoints;
      
      // Calculate new level (simple formula: level = sqrt(experience / 100))
      const newLevel = Math.floor(Math.sqrt(nft.experience / 100)) + 1;
      const leveledUp = newLevel > previousLevel;
      
      // Update level if changed
      if (leveledUp) {
        nft.currentLevel = newLevel;
        
        // Add level-up rewards
        this.applyLevelUpRewards(nft, newLevel);
      }
      
      // Add history entry
      nft.history.push({
        timestamp: new Date(),
        event: source,
        previousLevel: leveledUp ? previousLevel : undefined,
        newLevel: leveledUp ? newLevel : undefined,
        experienceGained: experiencePoints
      });
      
      nft.lastUpdated = new Date();
      await nft.save();
      
      // Update on-chain metadata if leveled up
      let transactionHash;
      if (leveledUp) {
        transactionHash = await this.updateOnChainMetadata(nft);
      }
      
      return {
        previousLevel,
        newLevel: nft.currentLevel,
        leveledUp,
        updatedNFT: nft,
        transactionHash
      };
    } catch (error) {
      console.error(`Error adding experience to NFT ${tokenId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update NFT attributes based on performance
   */
  async updateAttributes(
    tokenId: number,
    attributeUpdates: {
      performance?: number;
      participation?: number;
      loyalty?: number;
      specialAbilities?: string[];
    }
  ): Promise<{
    updatedNFT: IDynamicNFT;
    changedAttributes: string[];
    transactionHash?: string;
  }> {
    try {
      const nft = await this.getDynamicNFT(tokenId);
      const changedAttributes = [];
      
      // Update attributes
      if (attributeUpdates.performance !== undefined) {
        nft.attributes.performance = Math.max(0, Math.min(100, attributeUpdates.performance));
        changedAttributes.push('performance');
      }
      
      if (attributeUpdates.participation !== undefined) {
        nft.attributes.participation = Math.max(0, Math.min(100, attributeUpdates.participation));
        changedAttributes.push('participation');
      }
      
      if (attributeUpdates.loyalty !== undefined) {
        nft.attributes.loyalty = Math.max(0, Math.min(100, attributeUpdates.loyalty));
        changedAttributes.push('loyalty');
      }
      
      if (attributeUpdates.specialAbilities) {
        // Add new abilities without duplicates
        const newAbilities = attributeUpdates.specialAbilities.filter(
          ability => !nft.attributes.specialAbilities.includes(ability)
        );
        
        if (newAbilities.length > 0) {
          nft.attributes.specialAbilities = [
            ...nft.attributes.specialAbilities,
            ...newAbilities
          ];
          changedAttributes.push('specialAbilities');
        }
      }
      
      // Only proceed if attributes changed
      if (changedAttributes.length === 0) {
        return { updatedNFT: nft, changedAttributes: [] };
      }
      
      // Update visual elements based on new attributes
      const visualChanges = await this.updateVisualElements(nft);
      
      // Add history entry
      nft.history.push({
        timestamp: new Date(),
        event: 'attributes_updated',
        attributesChanged: changedAttributes,
        visualElementsChanged: visualChanges
      });
      
      nft.lastUpdated = new Date();
      await nft.save();
      
      // Update on-chain metadata
      const transactionHash = await this.updateOnChainMetadata(nft);
      
      return {
        updatedNFT: nft,
        changedAttributes,
        transactionHash
      };
    } catch (error) {
      console.error(`Error updating attributes for NFT ${tokenId}:`, error);
      throw error;
    }
  }
  
  /**
   * Apply rewards for leveling up
   */
  private applyLevelUpRewards(nft: IDynamicNFT, newLevel: number): void {
    // Add level-specific visual elements
    if (newLevel >= 5 && !nft.visualElements.overlays.includes('bronze_frame')) {
      nft.visualElements.overlays.push('bronze_frame');
    }
    
    if (newLevel >= 10 && !nft.visualElements.overlays.includes('silver_frame')) {
      // Replace bronze with silver
      const bronzeIndex = nft.visualElements.overlays.indexOf('bronze_frame');
      if (bronzeIndex >= 0) {
        nft.visualElements.overlays[bronzeIndex] = 'silver_frame';
      } else {
        nft.visualElements.overlays.push('silver_frame');
      }
    }
    
    if (newLevel >= 20 && !nft.visualElements.overlays.includes('gold_frame')) {
      // Replace silver with gold
      const silverIndex = nft.visualElements.overlays.indexOf('silver_frame');
      if (silverIndex >= 0) {
        nft.visualElements.overlays[silverIndex] = 'gold_frame';
      } else {
        nft.visualElements.overlays.push('gold_frame');
      }
    }
    
    // Add animations at certain levels
    if (newLevel >= 15 && !nft.visualElements.animations.includes('sparkle')) {
      nft.visualElements.animations.push('sparkle');
    }
    
    if (newLevel >= 25 && !nft.visualElements.animations.includes('aura')) {
      nft.visualElements.animations.push('aura');
    }
    
    // Special abilities based on level
    if (newLevel >= 10 && !nft.attributes.specialAbilities.includes('tournament_discount')) {
      nft.attributes.specialAbilities.push('tournament_discount');
    }
    
    if (newLevel >= 20 && !nft.attributes.specialAbilities.includes('priority_registration')) {
      nft.attributes.specialAbilities.push('priority_registration');
    }
  }
  
  /**
   * Update visual elements based on attributes
   */
  private async updateVisualElements(nft: IDynamicNFT): Promise<string[]> {
    const changedElements = [];
    
    // Performance affects color scheme
    if (nft.attributes.performance >= 90 && nft.visualElements.colorScheme !== 'legendary') {
      nft.visualElements.colorScheme = 'legendary';
      changedElements.push('colorScheme');
    } else if (nft.attributes.performance >= 75 && nft.visualElements.colorScheme !== 'epic') {
      nft.visualElements.colorScheme = 'epic';
      changedElements.push('colorScheme');
    } else if (nft.attributes.performance >= 60 && nft.visualElements.colorScheme !== 'rare') {
      nft.visualElements.colorScheme = 'rare';
      changedElements.push('colorScheme');
    }
    
    // Participation affects overlays
    if (nft.attributes.participation >= 80 && !nft.visualElements.overlays.includes('veteran_badge')) {
      nft.visualElements.overlays.push('veteran_badge');
      changedElements.push('overlays');
    }
    
    // Loyalty affects animations
    if (nft.attributes.loyalty >= 90 && !nft.visualElements.animations.includes('premium_effect')) {
      nft.visualElements.animations.push('premium_effect');
      changedElements.push('animations');
    }
    
    return changedElements;
  }
  
  /**
   * Generate base image for NFT
   */
  private async generateBaseImage(tournamentId: string, rarity: number): Promise<string> {
    // In a real implementation, this would generate or select an appropriate image
    // For now, return a placeholder
    return `https://api.play-plus.example/nft/images/${tournamentId}/${rarity}/base.png`;
  }
  
  /**
   * Generate metadata URI for NFT
   */
  private async generateMetadataURI(tournamentId: string, rarity: number): Promise<string> {
    // In a real implementation, this would generate and store metadata on IPFS
    // For now, return a placeholder
    return `https://api.play-plus.example/nft/metadata/${tournamentId}/${rarity}`;
  }
  
  /**
   * Update on-chain metadata
   */
  private async updateOnChainMetadata(nft: IDynamicNFT): Promise<string | undefined> {
    try {
      // Generate new metadata URI
      const newURI = await this.generateUpdatedMetadataURI(nft);
      
      // Connect to contract with admin signer
      const signer = this.provider.getSigner();
      const contract = new ethers.Contract(
        this.contractAddress,
        PLAY_PLUS_TICKET_ABI,
        signer
      );
      
      // Update token URI on-chain
      const tx = await contract.updateTokenURI(nft.tokenId, newURI);
      const receipt = await tx.wait();
      
      // Update URI in database
      nft.baseURI = newURI;
      await nft.save();
      
      return receipt.transactionHash;
    } catch (error) {
      console.error(`Error updating on-chain metadata for NFT ${nft.tokenId}:`, error);
      // Return undefined but don't throw, as this is a non-critical operation
      return undefined;
    }
  }
  
  /**
   * Generate updated metadata URI
   */
  private async generateUpdatedMetadataURI(nft: IDynamicNFT): Promise<string> {
    // In a real implementation, this would generate new metadata and store it on IPFS
    // For now, return a placeholder with timestamp to ensure uniqueness
    return `https://api.play-plus.example/nft/metadata/${nft.tournamentId}/${nft.attributes.rarity}/${nft.currentLevel}?ts=${Date.now()}`;
  }
  
  /**
   * Process tournament results and update NFTs
   */
  async processTournamentResults(
    tournamentId: string,
    results: {
      userId: string;
      tokenId: number;
      rank: number;
      score: number;
      matchesPlayed: number;
      matchesWon: number;
    }[]
  ): Promise<{
    processedCount: number;
    levelUps: number;
    attributeChanges: number;
  }> {
    try {
      let processedCount = 0;
      let levelUps = 0;
      let attributeChanges = 0;
      
      for (const result of results) {
        try {
          // Calculate experience based on performance
          let experiencePoints = 0;
          
          // Base experience for participation
          experiencePoints += result.matchesPlayed * 10;
          
          // Bonus for wins
          experiencePoints += result.matchesWon * 20;
          
          // Bonus for high rank
          if (result.rank === 1) {
            experiencePoints += 200; // 1st place
          } else if (result.rank === 2) {
            experiencePoints += 150; // 2nd place
          } else if (result.rank === 3) {
            experiencePoints += 100; // 3rd place
          } else if (result.rank <= 10) {
            experiencePoints += 50; // Top 10
          }
          
          // Add experience to NFT
          const expResult = await this.addExperience(
            result.tokenId,
            experiencePoints,
            'tournament_results'
          );
          
          if (expResult.leveledUp) {
            levelUps++;
          }
          
          // Calculate attribute updates
          const winRate = result.matchesPlayed > 0 
            ? (result.matchesWon / result.matchesPlayed) * 100 
            : 0;
          
          const performanceScore = Math.min(100, 
            (winRate * 0.5) + 
            (Math.max(0, 11 - result.rank) * 5)
          );
          
          const participationScore = Math.min(100, result.matchesPlayed * 10);
          
          // Update attributes
          const attrResult = await this.updateAttributes(
            result.tokenId,
            {
              performance: performanceScore,
              participation: participationScore
            }
          );
          
          if (attrResult.changedAttributes.length > 0) {
            attributeChanges++;
          }
          
          processedCount++;
        } catch (error) {
          console.error(`Error processing tournament result for token ${result.tokenId}:`, error);
          // Continue with next result
        }
      }
      
      return {
        processedCount,
        levelUps,
        attributeChanges
      };
    } catch (error) {
      console.error(`Error processing tournament results for ${tournamentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process PlayCoin usage and update NFT loyalty
   */
  async processPlayCoinUsage(
    tokenId: number,
    playCoinsSpent: number,
    purpose: string
  ): Promise<{
    loyaltyBefore: number;
    loyaltyAfter: number;
    experienceGained: number;
  }> {
    try {
      const nft = await this.getDynamicNFT(tokenId);
      const loyaltyBefore = nft.attributes.loyalty;
      
      // Calculate loyalty increase (diminishing returns)
      const loyaltyIncrease = Math.min(10, Math.ceil(playCoinsSpent / 100));
      const newLoyalty = Math.min(100, loyaltyBefore + loyaltyIncrease);
      
      // Calculate experience points (1 point per 10 coins spent)
      const experiencePoints = Math.ceil(playCoinsSpent / 10);
      
      // Update attributes
      await this.updateAttributes(
        tokenId,
        { loyalty: newLoyalty }
      );
      
      // Add experience
      await this.addExperience(
        tokenId,
        experiencePoints,
        `playcoin_${purpose}`
      );
      
      return {
        loyaltyBefore,
        loyaltyAfter: newLoyalty,
        experienceGained: experiencePoints
      };
    } catch (error) {
      console.error(`Error processing PlayCoin usage for NFT ${tokenId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get NFT abilities and benefits
   */
  async getNFTBenefits(tokenId: number): Promise<{
    discounts: {
      type: string;
      percentage: number;
    }[];
    abilities: {
      name: string;
      description: string;
    }[];
    rewards: {
      type: string;
      value: number;
      description: string;
    }[];
  }> {
    try {
      const nft = await this.getDynamicNFT(tokenId);
      
      // Calculate benefits based on level and attributes
      const discounts = [];
      const abilities = [];
      const rewards = [];
      
      // Level-based discounts
      if (nft.currentLevel >= 10) {
        discounts.push({
          type: 'tournament_entry',
          percentage: Math.min(30, nft.currentLevel)
        });
      }
      
      // Special abilities
      for (const ability of nft.attributes.specialAbilities) {
        switch (ability) {
          case 'tournament_discount':
            abilities.push({
              name: 'Tournament Discount',
              description: 'Receive discounts on tournament entry fees'
            });
            break;
          case 'priority_registration':
            abilities.push({
              name: 'Priority Registration',
              description: 'Get early access to tournament registration'
            });
            break;
          // Add more abilities as needed
        }
      }
      
      // Loyalty rewards
      if (nft.attributes.loyalty >= 80) {
        rewards.push({
          type: 'daily_playcoin_bonus',
          value: Math.floor(nft.attributes.loyalty / 10),
          description: `Daily PlayCoin bonus of ${Math.floor(nft.attributes.loyalty / 10)} coins`
        });
      }
      
      // Performance rewards
      if (nft.attributes.performance >= 70) {
        rewards.push({
          type: 'matchmaking_priority',
          value: Math.floor(nft.attributes.performance / 10),
          description: 'Priority in matchmaking queue'
        });
      }
      
      return {
        discounts,
        abilities,
        rewards
      };
    } catch (error) {
      console.error(`Error getting benefits for NFT ${tokenId}:`, error);
      throw error;
    }
  }
}

/**
 * Reward Distribution Service Implementation
 */
class RewardDistributionService {
  private contractAddress: string;
  private provider: ethers.providers.Provider;
  
  constructor(contractAddress: string, provider: ethers.providers.Provider) {
    this.contractAddress = contractAddress;
    this.provider = provider;
  }
  
  /**
   * Calculate rewards for tournament participants
   */
  async calculateTournamentRewards(
    tournamentId: string,
    participants: {
      userId: string;
      tokenId: number;
      rank: number;
      score: number;
      matchesPlayed: number;
      matchesWon: number;
    }[],
    prizePool: number
  ): Promise<{
    distributions: {
      userId: string;
      tokenId: number;
      rank: number;
      rewardAmount: number;
      rewardPercentage: number;
      bonusFactor: number;
    }[];
    totalDistributed: number;
  }> {
    try {
      // Sort participants by rank
      const sortedParticipants = [...participants].sort((a, b) => a.rank - b.rank);
      
      // Calculate base distribution percentages
      const distributions = [];
      let totalPercentage = 0;
      
      for (const participant of sortedParticipants) {
        // Base percentage based on rank
        let percentage = 0;
        
        if (participant.rank === 1) {
          percentage = 30; // 1st place: 30%
        } else if (participant.rank === 2) {
          percentage = 20; // 2nd place: 20%
        } else if (participant.rank === 3) {
          percentage = 15; // 3rd place: 15%
        } else if (participant.rank <= 5) {
          percentage = 7; // 4th-5th place: 7% each
        } else if (participant.rank <= 10) {
          percentage = 2; // 6th-10th place: 2% each
        } else {
          percentage = 0.5; // Everyone else: 0.5% each
        }
        
        // Calculate bonus factor based on matches played and win rate
        const winRate = participant.matchesPlayed > 0 
          ? participant.matchesWon / participant.matchesPlayed 
          : 0;
        
        const participationFactor = Math.min(1, participant.matchesPlayed / 10);
        const performanceFactor = winRate;
        
        const bonusFactor = 1 + (participationFactor * 0.1) + (performanceFactor * 0.2);
        
        // Apply bonus factor to percentage
        const adjustedPercentage = percentage * bonusFactor;
        
        distributions.push({
          userId: participant.userId,
          tokenId: participant.tokenId,
          rank: participant.rank,
          rewardAmount: 0, // Will calculate after summing percentages
          rewardPercentage: adjustedPercentage,
          bonusFactor
        });
        
        totalPercentage += adjustedPercentage;
      }
      
      // Normalize percentages to ensure they sum to 100%
      const normalizationFactor = 100 / totalPercentage;
      
      // Calculate final reward amounts
      let totalDistributed = 0;
      
      for (const distribution of distributions) {
        const normalizedPercentage = distribution.rewardPercentage * normalizationFactor;
        const rewardAmount = Math.floor((prizePool * normalizedPercentage) / 100);
        
        distribution.rewardPercentage = normalizedPercentage;
        distribution.rewardAmount = rewardAmount;
        
        totalDistributed += rewardAmount;
      }
      
      return {
        distributions,
        totalDistributed
      };
    } catch (error) {
      console.error(`Error calculating tournament rewards for ${tournamentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Distribute rewards to winners
   */
  async distributeRewards(
    tournamentId: string,
    distributions: {
      userId: string;
      tokenId: number;
      rewardAmount: number;
    }[]
  ): Promise<{
    successCount: number;
    failureCount: number;
    transactionHash?: string;
  }> {
    try {
      // Connect to reward distribution contract
      const signer = this.provider.getSigner();
      const contract = new ethers.Contract(
        this.contractAddress,
        [
          "function declareWinners(uint256 tournamentId, address[] memory winners, uint256[] memory shares) public",
          "function claimReward(uint256 tournamentId) public"
        ],
        signer
      );
      
      // Prepare winners and shares arrays
      const winners = [];
      const shares = [];
      
      for (const distribution of distributions) {
        if (distribution.rewardAmount > 0) {
          // In a real implementation, we would get the user's wallet address
          // For now, use a placeholder
          const userAddress = `0x${distribution.userId.padStart(40, '0')}`;
          winners.push(userAddress);
          shares.push(ethers.utils.parseUnits(distribution.rewardAmount.toString(), 18));
        }
      }
      
      // Declare winners on-chain
      const tx = await contract.declareWinners(
        tournamentId,
        winners,
        shares
      );
      
      const receipt = await tx.wait();
      const transactionHash = receipt.transactionHash;
      
      return {
        successCount: winners.length,
        failureCount: 0,
        transactionHash
      };
    } catch (error) {
      console.error(`Error distributing rewards for tournament ${tournamentId}:`, error);
      
      // Return failure count
      return {
        successCount: 0,
        failureCount: distributions.length
      };
    }
  }
  
  /**
   * Check if a user has a pending reward
   */
  async checkPendingReward(
    tournamentId: string,
    userId: string
  ): Promise<{
    hasPendingReward: boolean;
    rewardAmount?: number;
    canClaim: boolean;
  }> {
    try {
      // In a real implementation, this would check the contract state
      // For now, return a placeholder
      return {
        hasPendingReward: true,
        rewardAmount: 100,
        canClaim: true
      };
    } catch (error) {
      console.error(`Error checking pending reward for user ${userId} in tournament ${tournamentId}:`, error);
      
      return {
        hasPendingReward: false,
        canClaim: false
      };
    }
  }
  
  /**
   * Claim reward for a user
   */
  async claimReward(
    tournamentId: string,
    userId: string
  ): Promise<{
    success: boolean;
    claimedAmount?: number;
    transactionHash?: string;
  }> {
    try {
      // Check if user has a pending reward
      const { hasPendingReward, rewardAmount, canClaim } = await this.checkPendingReward(
        tournamentId,
        userId
      );
      
      if (!hasPendingReward || !canClaim) {
        return {
          success: false
        };
      }
      
      // Connect to reward distribution contract
      const signer = this.provider.getSigner();
      const contract = new ethers.Contract(
        this.contractAddress,
        [
          "function claimReward(uint256 tournamentId) public"
        ],
        signer
      );
      
      // Claim reward on-chain
      const tx = await contract.claimReward(tournamentId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        claimedAmount: rewardAmount,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error(`Error claiming reward for user ${userId} in tournament ${tournamentId}:`, error);
      
      return {
        success: false
      };
    }
  }
}

// Note: The following code would create service instances in a real implementation
// For this example, we're just exporting the classes
export {
  DynamicNFTService,
  RewardDistributionService
};
