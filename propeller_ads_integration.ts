/**
 * Propeller Ads Integration for Telegram Mini App
 * 
 * This file provides a complete integration with Propeller Ads network
 * for the Telegram web3 game tournament mini-app.
 */

import { useState, useEffect, useCallback } from 'react';

// Propeller Ads SDK configuration interface
interface PropellerAdsConfig {
  publisherId: string;
  zoneId: string;
  adType: string;
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
 * Propeller Ads Client for Telegram Mini Apps
 * Handles ad loading, viewing, and verification
 */
export class PropellerAdsClient {
  private config: PropellerAdsConfig;
  private adContainer: HTMLElement | null = null;
  private currentAd: any = null;
  private viewStartTime: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();
  private userId: number;
  private telegramWebApp: any;

  /**
   * Initialize Propeller Ads client
   * @param config Propeller Ads configuration
   */
  constructor(config: PropellerAdsConfig) {
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
    
    // Initialize Propeller Ads SDK when DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializePropellerAdsSDK());
      } else {
        this.initializePropellerAdsSDK();
      }
    }
  }

  /**
   * Initialize Propeller Ads SDK
   * Loads the SDK script and sets up the global objects
   */
  private initializePropellerAdsSDK(): void {
    if (typeof document === 'undefined') return;
    
    // Check if SDK is already loaded
    if (document.getElementById('propeller-ads-sdk')) {
      this.setupPropellerAds();
      return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.id = 'propeller-ads-sdk';
    script.src = `https://propu.sh/pfe/current/tag.min.js?z=${this.config.zoneId}&var=${this.config.publisherId}`;
    script.async = true;
    
    // Set up onload handler
    script.onload = () => {
      this.setupPropellerAds();
    };
    
    // Set up error handler
    script.onerror = () => {
      this.emit('error', { message: 'Failed to load Propeller Ads SDK' });
    };
    
    // Append script to document
    document.head.appendChild(script);
  }

  /**
   * Set up Propeller Ads after SDK is loaded
   */
  private setupPropellerAds(): void {
    if (typeof window === 'undefined' || !window.propellerAds) {
      this.emit('error', { message: 'Propeller Ads SDK not available' });
      return;
    }
    
    // Initialize the SDK with our configuration
    window.propellerAds = window.propellerAds || [];
    window.propellerAds.push({
      adType: this.config.adType,
      siteId: this.config.publisherId,
      zoneId: this.config.zoneId,
      events: {
        onLoad: (data: any) => {
          this.currentAd = data;
          this.emit('load', data);
        },
        onImpression: (data: any) => {
          this.viewStartTime = Date.now();
          this.emit('impression', data);
        },
        onClick: (data: any) => {
          this.emit('click', data);
        },
        onError: (error: any) => {
          this.emit('error', error);
        }
      }
    });
  }

  /**
   * Load an ad into the specified container
   * @param container HTML element to load the ad into
   * @param adType Type of ad to load (short, medium, long)
   */
  loadAd(container: HTMLElement, adType: string = 'medium'): void {
    this.adContainer = container;
    
    if (!window.propellerAds) {
      this.emit('error', { message: 'Propeller Ads SDK not initialized' });
      return;
    }
    
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create ad container
    const adDiv = document.createElement('div');
    adDiv.id = `propeller-ad-${Date.now()}`;
    container.appendChild(adDiv);
    
    // Load ad
    window.propellerAds.push({
      adType: this.config.adType,
      siteId: this.config.publisherId,
      zoneId: this.config.zoneId,
      containerId: adDiv.id,
      keywords: [...(this.config.keywords || []), adType],
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
 * React hook for using Propeller Ads in functional components
 * @param config Propeller Ads configuration
 */
export function usePropellerAds(config: PropellerAdsConfig) {
  const [client, setClient] = useState<PropellerAdsClient | null>(null);
  const [adRecord, setAdRecord] = useState<AdViewRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize client
  useEffect(() => {
    const propellerAdsClient = new PropellerAdsClient(config);
    setClient(propellerAdsClient);
    
    return () => {
      propellerAdsClient.destroy();
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

// Add PropellerAds global type
declare global {
  interface Window {
    propellerAds: any;
  }
}
