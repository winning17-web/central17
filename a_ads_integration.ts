/**
 * A-ads Integration for Telegram Mini App
 * 
 * This file provides a complete integration with A-ads network
 * for the Telegram web3 game tournament mini-app.
 */

import { useState, useEffect, useCallback } from 'react';

// A-ads SDK configuration interface
interface AAdsConfig {
  adUnitId: string;
  size: string;
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
 * A-ads Client for Telegram Mini Apps
 * Handles ad loading, viewing, and verification
 */
export class AAdsClient {
  private config: AAdsConfig;
  private adContainer: HTMLElement | null = null;
  private currentAd: any = null;
  private viewStartTime: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();
  private userId: number;
  private telegramWebApp: any;

  /**
   * Initialize A-ads client
   * @param config A-ads configuration
   */
  constructor(config: AAdsConfig) {
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
    
    // Initialize A-ads SDK when DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeAAdsSDK());
      } else {
        this.initializeAAdsSDK();
      }
    }
  }

  /**
   * Initialize A-ads SDK
   * Loads the SDK script and sets up the global objects
   */
  private initializeAAdsSDK(): void {
    if (typeof document === 'undefined') return;
    
    // Check if SDK is already loaded
    if (document.getElementById('a-ads-sdk')) {
      this.setupAAds();
      return;
    }
    
    // A-ads doesn't have a traditional SDK, it uses iframe-based ad units
    // We'll create a custom event system to handle ad interactions
    this.setupAAds();
  }

  /**
   * Set up A-ads after SDK is loaded
   */
  private setupAAds(): void {
    // A-ads doesn't have a global object like other ad networks
    // We'll implement our own event handling system
    
    // Notify that setup is complete
    setTimeout(() => {
      this.emit('load', { message: 'A-ads setup complete' });
    }, 100);
  }

  /**
   * Load an ad into the specified container
   * @param container HTML element to load the ad into
   * @param adType Type of ad to load (short, medium, long)
   */
  loadAd(container: HTMLElement, adType: string = 'medium'): void {
    this.adContainer = container;
    
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create iframe for A-ads
    const iframe = document.createElement('iframe');
    iframe.id = `a-ads-frame-${Date.now()}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    
    // Set source based on ad unit ID and size
    iframe.src = `https://a-ads.com/units/${this.config.adUnitId}?size=${this.config.size}`;
    
    // Add additional parameters if available
    if (this.config.keywords && this.config.keywords.length > 0) {
      iframe.src += `&keywords=${encodeURIComponent(this.config.keywords.join(','))}`;
    }
    
    // Add theme parameter
    iframe.src += `&theme=${this.config.telegramTheme}`;
    
    // Append iframe to container
    container.appendChild(iframe);
    
    // Set up message listener for iframe communication
    window.addEventListener('message', this.handleIframeMessage);
    
    // Start tracking view time
    this.viewStartTime = Date.now();
    this.currentAd = {
      adId: `a-ads-${Date.now()}`,
      keywords: this.config.keywords || [],
      adUnitId: this.config.adUnitId
    };
    
    // Simulate impression event
    setTimeout(() => {
      this.emit('impression', this.currentAd);
    }, 1000);
  }

  /**
   * Handle messages from the iframe
   */
  private handleIframeMessage = (event: MessageEvent): void => {
    // Check if the message is from our iframe
    if (!event.data || typeof event.data !== 'object' || !event.data.aAdsEvent) {
      return;
    }
    
    const { type, data } = event.data;
    
    switch (type) {
      case 'click':
        this.emit('click', data);
        break;
      case 'impression':
        this.emit('impression', data);
        break;
      case 'error':
        this.emit('error', data);
        break;
    }
  };

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
    
    // Remove message listener
    window.removeEventListener('message', this.handleIframeMessage);
    
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
    window.removeEventListener('message', this.handleIframeMessage);
  }
}

/**
 * React hook for using A-ads in functional components
 * @param config A-ads configuration
 */
export function useAAds(config: AAdsConfig) {
  const [client, setClient] = useState<AAdsClient | null>(null);
  const [adRecord, setAdRecord] = useState<AdViewRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize client
  useEffect(() => {
    const aAdsClient = new AAdsClient(config);
    setClient(aAdsClient);
    
    return () => {
      aAdsClient.destroy();
    };
  }, [config.adUnitId, config.size]);
  
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
