/**
 * Adshares Integration for Telegram Mini App
 * 
 * This file provides a complete integration with Adshares ad network
 * for the Telegram web3 game tournament mini-app.
 */

import { useState, useEffect, useCallback } from 'react';

// Adshares SDK configuration interface
interface AdsharesConfig {
  publisherId: string;
  zoneId: string;
  serverUrl: string;
  keywords?: string[];
  responsive?: boolean;
  telegramTheme?: 'light' | 'dark';
}

// Ad view record interface
interface AdViewRecord {
  adId: string;
  userId: number;
  adType: string;
  timestamp: number;
  duration: number;
  completed: boolean;
  credits: number;
}

/**
 * Adshares Client for Telegram Mini Apps
 * Handles ad loading, viewing, and verification
 */
export class AdsharesClient {
  private config: AdsharesConfig;
  private adContainer: HTMLElement | null = null;
  private currentAd: any = null;
  private viewStartTime: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();
  private userId: number;
  private telegramWebApp: any;

  /**
   * Initialize Adshares client
   * @param config Adshares configuration
   */
  constructor(config: AdsharesConfig) {
    this.config = {
      ...config,
      responsive: config.responsive !== false,
      telegramTheme: config.telegramTheme || 'light'
    };
    
    // Get Telegram user ID if available
    this.userId = this.getTelegramUserId();
    this.telegramWebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    
    // Initialize event listeners map
    this.eventListeners.set('load', []);
    this.eventListeners.set('impression', []);
    this.eventListeners.set('click', []);
    this.eventListeners.set('complete', []);
    this.eventListeners.set('error', []);
    
    // Initialize Adshares SDK when DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeAdsharesSDK());
      } else {
        this.initializeAdsharesSDK();
      }
    }
  }

  /**
   * Initialize Adshares SDK
   * Loads the SDK script and sets up the global objects
   */
  private initializeAdsharesSDK(): void {
    if (typeof document === 'undefined') return;
    
    // Check if SDK is already loaded
    if (document.getElementById('adshares-sdk')) {
      this.setupAdshares();
      return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.id = 'adshares-sdk';
    script.src = `${this.config.serverUrl}/sdk.js`;
    script.async = true;
    
    // Set up onload handler
    script.onload = () => {
      this.setupAdshares();
    };
    
    // Set up error handler
    script.onerror = () => {
      this.emit('error', { message: 'Failed to load Adshares SDK' });
    };
    
    // Append script to document
    document.head.appendChild(script);
  }

  /**
   * Set up Adshares after SDK is loaded
   */
  private setupAdshares(): void {
    if (typeof window === 'undefined' || !window.adsharesSDK) {
      this.emit('error', { message: 'Adshares SDK not available' });
      return;
    }
    
    // Initialize the SDK with our configuration
    window.adsharesSDK.init({
      publisherId: this.config.publisherId,
      defaultZoneId: this.config.zoneId,
      options: {
        keywords: this.config.keywords || [],
        responsive: this.config.responsive,
        theme: this.config.telegramTheme
      }
    });
    
    // Set up global event listeners
    window.adsharesSDK.on('load', (data: any) => {
      this.currentAd = data;
      this.emit('load', data);
    });
    
    window.adsharesSDK.on('impression', (data: any) => {
      this.viewStartTime = Date.now();
      this.emit('impression', data);
    });
    
    window.adsharesSDK.on('click', (data: any) => {
      this.emit('click', data);
    });
  }

  /**
   * Load an ad into the specified container
   * @param container HTML element to load the ad into
   * @param adType Type of ad to load (short, medium, long)
   */
  loadAd(container: HTMLElement, adType: string = 'medium'): void {
    this.adContainer = container;
    
    if (!window.adsharesSDK) {
      this.emit('error', { message: 'Adshares SDK not initialized' });
      return;
    }
    
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Set ad type as keyword
    const keywords = [...(this.config.keywords || []), adType];
    
    // Load ad
    window.adsharesSDK.loadAd(container, {
      zoneId: this.config.zoneId,
      keywords,
      userId: this.userId.toString()
    });
  }

  /**
   * Complete ad viewing and calculate earned credits
   * @returns Ad view record with earned credits
   */
  completeAdView(): AdViewRecord | null {
    if (!this.currentAd || !this.viewStartTime) {
      return null;
    }
    
    const now = Date.now();
    const duration = now - this.viewStartTime;
    const minDuration = this.getMinDurationForAdType(this.getAdType());
    const completed = duration >= minDuration;
    
    // Calculate credits based on ad type and view duration
    const credits = completed ? this.getCreditsForAdType(this.getAdType()) : 0;
    
    // Create record
    const record: AdViewRecord = {
      adId: this.currentAd.adId || `ad_${now}`,
      userId: this.userId,
      adType: this.getAdType(),
      timestamp: now,
      duration,
      completed,
      credits
    };
    
    // Emit complete event
    this.emit('complete', record);
    
    // Reset state
    this.viewStartTime = 0;
    
    return record;
  }

  /**
   * Get the current ad type based on keywords
   */
  private getAdType(): string {
    if (!this.currentAd || !this.currentAd.keywords) {
      return 'medium'; // Default
    }
    
    const keywords = this.currentAd.keywords;
    
    if (keywords.includes('short')) return 'short';
    if (keywords.includes('long')) return 'long';
    return 'medium';
  }

  /**
   * Get minimum duration required for ad type
   * @param adType Ad type (short, medium, long)
   */
  private getMinDurationForAdType(adType: string): number {
    switch (adType) {
      case 'short':
        return 5000; // 5 seconds
      case 'medium':
        return 15000; // 15 seconds
      case 'long':
        return 30000; // 30 seconds
      default:
        return 15000;
    }
  }

  /**
   * Get credits earned for ad type
   * @param adType Ad type (short, medium, long)
   */
  private getCreditsForAdType(adType: string): number {
    switch (adType) {
      case 'short':
        return 5;
      case 'medium':
        return 10;
      case 'long':
        return 20;
      default:
        return 10;
    }
  }

  /**
   * Get Telegram user ID
   */
  private getTelegramUserId(): number {
    if (typeof window !== 'undefined' && 
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    return 0; // Default if not available
  }

  /**
   * Register event listener
   * @param event Event name
   * @param callback Callback function
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)?.push(callback);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param callback Callback function
   */
  off(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   * @param event Event name
   * @param data Event data
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.eventListeners.clear();
    this.currentAd = null;
    this.adContainer = null;
  }
}

/**
 * React hook for using Adshares in functional components
 * @param config Adshares configuration
 */
export function useAdshares(config: AdsharesConfig) {
  const [client, setClient] = useState<AdsharesClient | null>(null);
  const [adRecord, setAdRecord] = useState<AdViewRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize client
  useEffect(() => {
    const adsharesClient = new AdsharesClient(config);
    setClient(adsharesClient);
    
    return () => {
      adsharesClient.destroy();
    };
  }, [config.publisherId, config.zoneId]);
  
  // Set up event listeners
  useEffect(() => {
    if (!client) return;
    
    const onLoad = () => {
      setIsLoading(false);
    };
    
    const onError = (data: any) => {
      setIsLoading(false);
      setError(data.message || 'Unknown error');
    };
    
    const onComplete = (record: AdViewRecord) => {
      setAdRecord(record);
      
      // Store ad view record in Telegram storage
      if (typeof window !== 'undefined' && 
          window.Telegram?.WebApp?.CloudStorage && 
          record.completed) {
        
        const storageKey = `adview_${record.timestamp}`;
        window.Telegram.WebApp.CloudStorage.setItem(
          storageKey, 
          JSON.stringify(record)
        ).catch(console.error);
        
        // Update total credits
        updateTotalCredits(record.credits);
      }
    };
    
    client.on('load', onLoad);
    client.on('error', onError);
    client.on('complete', onComplete);
    
    return () => {
      client.off('load', onLoad);
      client.off('error', onError);
      client.off('complete', onComplete);
    };
  }, [client]);
  
  // Update total credits in Telegram storage
  const updateTotalCredits = useCallback(async (newCredits: number) => {
    if (!window.Telegram?.WebApp?.CloudStorage) return;
    
    try {
      // Get current credits
      const currentCreditsStr = await window.Telegram.WebApp.CloudStorage.getItem('total_ad_credits');
      const currentCredits = currentCreditsStr ? parseInt(currentCreditsStr, 10) : 0;
      
      // Update credits
      const updatedCredits = currentCredits + newCredits;
      await window.Telegram.WebApp.CloudStorage.setItem(
        'total_ad_credits', 
        updatedCredits.toString()
      );
    } catch (err) {
      console.error('Error updating credits:', err);
    }
  }, []);
  
  // Load ad into container
  const loadAd = useCallback((container: HTMLElement, adType: string = 'medium') => {
    if (!client) return;
    
    setIsLoading(true);
    setError(null);
    setAdRecord(null);
    
    client.loadAd(container, adType);
  }, [client]);
  
  // Complete ad viewing
  const completeAdView = useCallback(() => {
    if (!client) return null;
    
    const record = client.completeAdView();
    return record;
  }, [client]);
  
  return {
    loadAd,
    completeAdView,
    adRecord,
    isLoading,
    error
  };
}

/**
 * AdViewer component for Telegram Mini App
 * Displays ads and tracks viewing for tournament entry credits
 */
export const AdViewer: React.FC<{
  onAdComplete: (credits: number) => void;
  tournamentId: string;
  adType?: string;
}> = ({ onAdComplete, tournamentId, adType = 'medium' }) => {
  const [isWatching, setIsWatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [adCompleted, setAdCompleted] = useState(false);
  const adContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Configure Adshares
  const { loadAd, completeAdView, adRecord, isLoading, error } = useAdshares({
    publisherId: 'your-publisher-id', // Replace with your Adshares publisher ID
    zoneId: 'your-zone-id',          // Replace with your Adshares zone ID
    serverUrl: 'https://server.adshares.net',
    keywords: ['game', 'tournament', tournamentId],
    responsive: true,
    telegramTheme: window.Telegram?.WebApp?.colorScheme
  });
  
  // Start watching ad
  const startWatchingAd = () => {
    setIsWatching(true);
    setProgress(0);
    setAdCompleted(false);
    
    if (adContainerRef.current) {
      loadAd(adContainerRef.current, adType);
    }
  };
  
  // Simulate ad watching progress
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isWatching && !adCompleted) {
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 1;
          
          if (newProgress >= 100) {
            // Ad completed
            setAdCompleted(true);
            const record = completeAdView();
            
            if (record && record.completed) {
              onAdComplete(record.credits);
            }
            
            if (interval) clearInterval(interval);
            return 100;
          }
          
          return newProgress;
        });
      }, 300); // Update every 300ms
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWatching, adCompleted, completeAdView, onAdComplete]);
  
  return (
    <div className="ad-viewer">
      <h3>Watch Ad to Earn Tournament Credits</h3>
      
      {!isWatching ? (
        <button 
          className="watch-ad-button"
          onClick={startWatchingAd}
        >
          Watch {adType} Ad
        </button>
      ) : (
        <>
          <div className="ad-container" ref={adContainerRef}>
            {isLoading && <div className="ad-loading">Loading ad...</div>}
            {error && <div className="ad-error">Error: {error}</div>}
          </div>
          
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${progress}%` }}
            />
            <div className="progress-text">
              {adCompleted ? 'Complete!' : `${progress}%`}
            </div>
          </div>
          
          {adCompleted && (
            <div className="ad-completed">
              <p>You earned {adRecord?.credits || 0} tournament credits!</p>
              <button onClick={() => setIsWatching(false)}>Close</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Backend verification for Adshares ad views
 * To be used in your server-side code
 */
export class AdsharesVerifier {
  private secretKey: string;
  private serverUrl: string;
  
  constructor(secretKey: string, serverUrl: string) {
    this.secretKey = secretKey;
    this.serverUrl = serverUrl;
  }
  
  /**
   * Verify ad view from webhook
   * @param data Webhook payload
   */
  async verifyAdView(data: any): Promise<boolean> {
    // Verify signature
    if (!this.verifySignature(data)) {
      return false;
    }
    
    // Verify with Adshares server
    try {
      const response = await fetch(`${this.serverUrl}/api/verify-impression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`
        },
        body: JSON.stringify({
          impressionId: data.impressionId,
          publisherId: data.publisherId,
          zoneId: data.zoneId
        })
      });
      
      if (!response.ok) {
        return false;
      }
      
      const result = await response.json();
      return result.verified === true;
    } catch (error) {
      console.error('Error verifying ad view:', error);
      return false;
    }
  }
  
  /**
   * Verify signature from Adshares
   * @param data Webhook payload
   */
  private verifySignature(data: any): boolean {
    // Implementation depends on Adshares signature format
    // This is a placeholder - implement according to Adshares docs
    if (!data.signature || !data.impressionId) {
      return false;
    }
    
    // In a real implementation, you would verify the signature
    // using the Adshares public key
    return true;
  }
}

/**
 * Tournament entry manager using ad credits
 */
export class TournamentEntryManager {
  /**
   * Check if user has enough ad credits to join tournament
   * @param userId User ID
   * @param tournamentId Tournament ID
   * @param requiredCredits Required credits for entry
   */
  static async canJoinTournament(
    userId: number, 
    tournamentId: string,
    requiredCredits: number
  ): Promise<boolean> {
    const userCredits = await this.getUserAdCredits(userId);
    return userCredits >= requiredCredits;
  }
  
  /**
   * Get user's ad credits
   * @param userId User ID
   */
  static async getUserAdCredits(userId: number): Promise<number> {
    if (!window.Telegram?.WebApp?.CloudStorage) {
      return 0;
    }
    
    try {
      const creditsStr = await window.Telegram.WebApp.CloudStorage.getItem('total_ad_credits');
      return creditsStr ? parseInt(creditsStr, 10) : 0;
    } catch (error) {
      console.error('Error getting user credits:', error);
      return 0;
    }
  }
  
  /**
   * Deduct ad credits for tournament entry
   * @param userId User ID
   * @param tournamentId Tournament ID
   * @param credits Credits to deduct
   */
  static async deductCreditsForEntry(
    userId: number,
    tournamentId: string,
    credits: number
  ): Promise<boolean> {
    if (!window.Telegram?.WebApp?.CloudStorage) {
      return false;
    }
    
    try {
      const currentCredits = await this.getUserAdCredits(userId);
      
      if (currentCredits < credits) {
        return false;
      }
      
      const newCredits = currentCredits - credits;
      
      // Update credits
      await window.Telegram.WebApp.CloudStorage.setItem(
        'total_ad_credits',
        newCredits.toString()
      );
      
      // Record transaction
      const transaction = {
        userId,
        tournamentId,
        credits,
        timestamp: Date.now(),
        type: 'tournament_entry'
      };
      
      await window.Telegram.WebApp.CloudStorage.setItem(
        `transaction_${transaction.timestamp}`,
        JSON.stringify(transaction)
      );
      
      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  }
}
