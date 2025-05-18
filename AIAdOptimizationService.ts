/**
 * AI Ad Optimization Service for Telegram Mini App
 * 
 * This service enhances ad targeting and selection using AI-driven logic
 * to improve user experience and ad performance.
 */

import { AdNetworkType } from './ad_integrations/ad_manager';

// User context interface for ad targeting
interface UserContext {
  userId: string;
  telegramId?: number;
  preferences?: string[];
  adHistory?: AdInteraction[];
  location?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  connectionType?: 'wifi' | 'cellular' | 'unknown';
  timeOfDay?: number; // Hour of day (0-23)
}

// Ad interaction record
interface AdInteraction {
  adId: string;
  networkType: AdNetworkType;
  adType: string;
  timestamp: number;
  duration: number;
  completed: boolean;
  clicked: boolean;
}

// Ad selection parameters
interface AdSelectionParams {
  tournamentId: string;
  tournamentType?: string;
  gameCategory?: string;
  prizePool?: number;
  userContext?: UserContext;
}

// Ad recommendation result
interface AdRecommendation {
  networkType: AdNetworkType;
  adType: string;
  keywords: string[];
  priority: number;
  reasoning: string;
}

/**
 * AI-driven ad optimization service
 */
export class AIAdOptimizationService {
  // Network performance metrics
  private networkPerformance: Map<AdNetworkType, {
    impressions: number;
    completions: number;
    clicks: number;
    revenue: number;
  }> = new Map();
  
  // User preference cache
  private userPreferences: Map<string, {
    preferredNetwork?: AdNetworkType;
    preferredAdTypes?: string[];
    lastUpdated: number;
  }> = new Map();
  
  constructor() {
    // Initialize network performance with default values
    this.networkPerformance.set('propeller', {
      impressions: 0,
      completions: 0,
      clicks: 0,
      revenue: 0
    });
    
    this.networkPerformance.set('a-ads', {
      impressions: 0,
      completions: 0,
      clicks: 0,
      revenue: 0
    });
    
    // Load performance data from storage if available
    this.loadPerformanceData();
  }
  
  /**
   * Load performance data from storage
   */
  private loadPerformanceData(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const performanceData = window.localStorage.getItem('ad_network_performance');
        
        if (performanceData) {
          const parsed = JSON.parse(performanceData);
          
          if (parsed.propeller) {
            this.networkPerformance.set('propeller', parsed.propeller);
          }
          
          if (parsed['a-ads']) {
            this.networkPerformance.set('a-ads', parsed['a-ads']);
          }
        }
      }
    } catch (error) {
      console.error('Error loading ad performance data:', error);
    }
  }
  
  /**
   * Save performance data to storage
   */
  private savePerformanceData(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const performanceData = {
          propeller: this.networkPerformance.get('propeller'),
          'a-ads': this.networkPerformance.get('a-ads')
        };
        
        window.localStorage.setItem('ad_network_performance', JSON.stringify(performanceData));
      }
    } catch (error) {
      console.error('Error saving ad performance data:', error);
    }
  }
  
  /**
   * Record ad interaction for performance tracking
   * @param interaction Ad interaction details
   */
  recordAdInteraction(interaction: AdInteraction): void {
    const networkStats = this.networkPerformance.get(interaction.networkType);
    
    if (networkStats) {
      networkStats.impressions++;
      
      if (interaction.completed) {
        networkStats.completions++;
      }
      
      if (interaction.clicked) {
        networkStats.clicks++;
      }
      
      // Estimate revenue based on completion and clicks
      // This is a simplified model and should be replaced with actual revenue data
      const completionValue = interaction.completed ? 0.01 : 0;
      const clickValue = interaction.clicked ? 0.05 : 0;
      networkStats.revenue += completionValue + clickValue;
      
      this.networkPerformance.set(interaction.networkType, networkStats);
      this.savePerformanceData();
    }
    
    // Update user preferences if user ID is available
    if (interaction.adId && typeof window !== 'undefined' && 
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      
      const userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
      const userPref = this.userPreferences.get(userId) || {
        lastUpdated: Date.now()
      };
      
      // If user completed the ad, consider it a preference
      if (interaction.completed) {
        userPref.preferredNetwork = interaction.networkType;
        userPref.preferredAdTypes = userPref.preferredAdTypes || [];
        
        if (!userPref.preferredAdTypes.includes(interaction.adType)) {
          userPref.preferredAdTypes.push(interaction.adType);
        }
        
        userPref.lastUpdated = Date.now();
        this.userPreferences.set(userId, userPref);
      }
    }
  }
  
  /**
   * Get user context for ad targeting
   */
  getUserContext(): UserContext | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      const telegramWebApp = window.Telegram?.WebApp;
      
      if (!telegramWebApp || !telegramWebApp.initDataUnsafe?.user?.id) {
        return undefined;
      }
      
      const userId = telegramWebApp.initDataUnsafe.user.id.toString();
      const userPref = this.userPreferences.get(userId);
      
      // Get ad history from local storage
      let adHistory: AdInteraction[] = [];
      try {
        const adHistoryStr = window.localStorage.getItem(`ad_history_${userId}`);
        if (adHistoryStr) {
          adHistory = JSON.parse(adHistoryStr);
        }
      } catch (e) {
        console.error('Error loading ad history:', e);
      }
      
      // Determine device type
      let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        deviceType = /iPad|tablet|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'mobile';
      }
      
      // Determine connection type
      let connectionType: 'wifi' | 'cellular' | 'unknown' = 'unknown';
      if (navigator.connection) {
        connectionType = navigator.connection.type === 'cellular' ? 'cellular' : 'wifi';
      }
      
      return {
        userId,
        telegramId: telegramWebApp.initDataUnsafe.user.id,
        preferences: userPref?.preferredAdTypes || [],
        adHistory,
        deviceType,
        connectionType,
        timeOfDay: new Date().getHours()
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return undefined;
    }
  }
  
  /**
   * Recommend the best ad network and type based on context
   * @param params Selection parameters
   */
  recommendAd(params: AdSelectionParams): AdRecommendation {
    const userContext = params.userContext || this.getUserContext();
    
    // Default recommendation
    let recommendation: AdRecommendation = {
      networkType: 'propeller',
      adType: 'medium',
      keywords: [params.tournamentId, params.tournamentType || 'tournament'],
      priority: 1,
      reasoning: 'Default recommendation'
    };
    
    // If we have user context, use it for better targeting
    if (userContext) {
      // Check if user has preferred network
      const userPref = this.userPreferences.get(userContext.userId);
      if (userPref?.preferredNetwork) {
        recommendation.networkType = userPref.preferredNetwork;
        recommendation.reasoning = 'Based on user preference';
        recommendation.priority = 3;
      }
      
      // Check network performance
      const propellerStats = this.networkPerformance.get('propeller');
      const aAdsStats = this.networkPerformance.get('a-ads');
      
      if (propellerStats && aAdsStats) {
        // Calculate completion rates
        const propellerCompletionRate = propellerStats.impressions > 0 ? 
          propellerStats.completions / propellerStats.impressions : 0;
        
        const aAdsCompletionRate = aAdsStats.impressions > 0 ? 
          aAdsStats.completions / aAdsStats.impressions : 0;
        
        // If one network significantly outperforms the other, use it
        if (propellerCompletionRate > aAdsCompletionRate * 1.2) {
          recommendation.networkType = 'propeller';
          recommendation.reasoning = 'Based on higher completion rate';
          recommendation.priority = 2;
        } else if (aAdsCompletionRate > propellerCompletionRate * 1.2) {
          recommendation.networkType = 'a-ads';
          recommendation.reasoning = 'Based on higher completion rate';
          recommendation.priority = 2;
        }
      }
      
      // Adjust ad type based on device and time of day
      if (userContext.deviceType === 'mobile') {
        // On mobile, prefer shorter ads
        recommendation.adType = 'short';
        recommendation.reasoning += ', optimized for mobile';
      } else if (userContext.deviceType === 'desktop' && 
                (userContext.timeOfDay >= 20 || userContext.timeOfDay <= 6)) {
        // On desktop during evening/night, users might be more willing to watch longer ads
        recommendation.adType = 'long';
        recommendation.reasoning += ', optimized for evening desktop viewing';
      }
      
      // Add relevant keywords based on context
      if (params.gameCategory) {
        recommendation.keywords.push(params.gameCategory);
      }
      
      if (params.prizePool && params.prizePool > 1000) {
        recommendation.keywords.push('high-stakes');
      }
      
      // If user has preferences, add them as keywords
      if (userContext.preferences && userContext.preferences.length > 0) {
        recommendation.keywords = [
          ...recommendation.keywords,
          ...userContext.preferences.slice(0, 3) // Take up to 3 preferences
        ];
      }
    }
    
    return recommendation;
  }
  
  /**
   * Get optimal ad placement strategy
   * @param pageType Type of page (e.g., 'tournament', 'profile', 'leaderboard')
   */
  getAdPlacementStrategy(pageType: string): {
    positions: string[];
    frequency: number;
    spacing: number;
  } {
    switch (pageType) {
      case 'tournament':
        return {
          positions: ['pre-game', 'post-game'],
          frequency: 1, // Show ad every game
          spacing: 0    // No additional spacing
        };
      case 'profile':
        return {
          positions: ['sidebar', 'bottom'],
          frequency: 1,
          spacing: 2    // Space between ads
        };
      case 'leaderboard':
        return {
          positions: ['top', 'between-sections'],
          frequency: 2, // Show ad every 2 sections
          spacing: 3
        };
      default:
        return {
          positions: ['bottom'],
          frequency: 1,
          spacing: 0
        };
    }
  }
  
  /**
   * Optimize ad timing based on user engagement
   * @param userEngagementLevel Level of user engagement (1-10)
   */
  optimizeAdTiming(userEngagementLevel: number): {
    initialDelay: number;
    minInterval: number;
    maxAdsPerSession: number;
  } {
    // For highly engaged users, show fewer ads with longer intervals
    if (userEngagementLevel >= 8) {
      return {
        initialDelay: 120, // 2 minutes before first ad
        minInterval: 300,  // 5 minutes between ads
        maxAdsPerSession: 2
      };
    }
    // For moderately engaged users
    else if (userEngagementLevel >= 5) {
      return {
        initialDelay: 60,  // 1 minute before first ad
        minInterval: 180,  // 3 minutes between ads
        maxAdsPerSession: 4
      };
    }
    // For less engaged users, show more ads with shorter intervals
    else {
      return {
        initialDelay: 30,  // 30 seconds before first ad
        minInterval: 120,  // 2 minutes between ads
        maxAdsPerSession: 6
      };
    }
  }
}

// Export singleton instance
export default new AIAdOptimizationService();
