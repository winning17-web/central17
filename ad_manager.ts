/**
 * Ad Integration Manager for Telegram Mini App
 * 
 * This file provides a unified interface for multiple ad networks
 * to be used interchangeably in the Telegram web3 game tournament mini-app.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePropellerAds } from './propeller_ads_integration';
import { useAAds } from './a_ads_integration';

// Ad network type
export type AdNetworkType = 'propeller' | 'a-ads';

// Unified ad configuration interface
export interface AdConfig {
  network: AdNetworkType;
  // Propeller Ads specific
  publisherId?: string;
  zoneId?: string;
  adType?: string;
  // A-ads specific
  adUnitId?: string;
  size?: string;
  // Common properties
  keywords?: string[];
  responsive?: boolean;
  telegramTheme?: 'light' | 'dark';
}

// Ad view record interface (same as in individual integrations)
export interface AdViewRecord {
  adId: string;
  userId: number;
  adType: string;
  timestamp: number;
  duration: number;
  completed: boolean;
  credits: number;
}

/**
 * React hook for using multiple ad networks in functional components
 * @param config Ad configuration
 */
export function useAds(config: AdConfig) {
  // State for the unified interface
  const [adRecord, setAdRecord] = useState<AdViewRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize Propeller Ads hook if selected
  const propellerAds = usePropellerAds({
    publisherId: config.publisherId || '',
    zoneId: config.zoneId || '',
    adType: config.adType || 'banner',
    keywords: config.keywords,
    responsive: config.responsive,
    telegramTheme: config.telegramTheme
  });
  
  // Initialize A-ads hook if selected
  const aAds = useAAds({
    adUnitId: config.adUnitId || '',
    size: config.size || '728x90',
    keywords: config.keywords,
    responsive: config.responsive,
    telegramTheme: config.telegramTheme
  });
  
  // Update unified state when individual ad network states change
  useEffect(() => {
    if (config.network === 'propeller') {
      setAdRecord(propellerAds.adRecord);
      setIsLoading(propellerAds.isLoading);
      setError(propellerAds.error);
    } else if (config.network === 'a-ads') {
      setAdRecord(aAds.adRecord);
      setIsLoading(aAds.isLoading);
      setError(aAds.error);
    }
  }, [
    config.network,
    propellerAds.adRecord, propellerAds.isLoading, propellerAds.error,
    aAds.adRecord, aAds.isLoading, aAds.error
  ]);
  
  // Load ad into container
  const loadAd = useCallback((container: HTMLElement, adType: string = 'medium') => {
    if (config.network === 'propeller') {
      propellerAds.loadAd(container, adType);
    } else if (config.network === 'a-ads') {
      aAds.loadAd(container, adType);
    }
  }, [config.network, propellerAds.loadAd, aAds.loadAd]);
  
  // Complete ad viewing
  const completeAdView = useCallback(() => {
    if (config.network === 'propeller') {
      return propellerAds.completeAdView();
    } else if (config.network === 'a-ads') {
      return aAds.completeAdView();
    }
    return null;
  }, [config.network, propellerAds.completeAdView, aAds.completeAdView]);
  
  return {
    loadAd,
    completeAdView,
    adRecord,
    isLoading,
    error
  };
}
