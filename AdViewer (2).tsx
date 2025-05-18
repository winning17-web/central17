/**
 * Enhanced AdViewer component that uses the new AI Ad Optimization Service
 * to dynamically select and display ads from either Propeller Ads or A-ads
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAds } from './ad_integrations/ad_manager';
import AIAdOptimizationService from './AIAdOptimizationService';

interface AdViewerProps {
  onAdComplete: () => void;
  tournamentId: string;
  tournamentType?: string;
  gameCategory?: string;
  prizePool?: number;
}

export default function AdViewer({ 
  onAdComplete, 
  tournamentId,
  tournamentType = 'standard',
  gameCategory,
  prizePool
}: AdViewerProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [adCompleted, setAdCompleted] = useState(false);
  const [adClicked, setAdClicked] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  
  // Get AI recommendation for optimal ad network and type
  const recommendation = AIAdOptimizationService.recommendAd({
    tournamentId,
    tournamentType,
    gameCategory,
    prizePool,
    userContext: AIAdOptimizationService.getUserContext()
  });
  
  // Configure ad network based on AI recommendation
  const adConfig = {
    network: recommendation.networkType,
    // Propeller Ads config
    publisherId: 'your-publisher-id', // Replace with your Propeller Ads publisher ID
    zoneId: 'your-zone-id',          // Replace with your Propeller Ads zone ID
    adType: 'banner',
    // A-ads config
    adUnitId: 'your-ad-unit-id',     // Replace with your A-ads unit ID
    size: '728x90',
    // Common config
    keywords: recommendation.keywords,
    responsive: true,
    telegramTheme: typeof window !== 'undefined' ? window.Telegram?.WebApp?.colorScheme : 'light'
  };
  
  const { loadAd, completeAdView, adRecord, isLoading, error } = useAds(adConfig);
  
  // Start watching ad
  const startWatchingAd = () => {
    setIsWatching(true);
    setProgress(0);
    setAdCompleted(false);
    setAdClicked(false);
    
    if (adContainerRef.current) {
      loadAd(adContainerRef.current, recommendation.adType);
    }
  };
  
  // Handle ad container click to track clicks
  const handleAdContainerClick = () => {
    if (isWatching && !adCompleted) {
      setAdClicked(true);
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
              // Record the interaction in AI service
              AIAdOptimizationService.recordAdInteraction({
                adId: record.adId,
                networkType: recommendation.networkType,
                adType: recommendation.adType,
                timestamp: Date.now(),
                duration: record.duration,
                completed: true,
                clicked: adClicked
              });
              
              onAdComplete();
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
  }, [isWatching, adCompleted, completeAdView, onAdComplete, recommendation.networkType, recommendation.adType, adClicked]);
  
  return (
    <div className="card p-6 max-w-md mx-auto">
      <h3 className="header text-center">Watch Ad to Join Tournament</h3>
      
      {!isWatching && !adCompleted && (
        <div className="text-center">
          <p className="mb-4">
            Watch a short advertisement to earn a free entry ticket for this tournament.
          </p>
          <button 
            onClick={startWatchingAd}
            className="btn-gold"
          >
            Start Watching
          </button>
        </div>
      )}
      
      {isWatching && !adCompleted && (
        <>
          <div 
            className="ad-container" 
            ref={adContainerRef}
            onClick={handleAdContainerClick}
          >
            {isLoading && <div className="ad-loading">Loading ad...</div>}
            {error && <div className="ad-error">Error: {error}</div>}
          </div>
          
          <div className="mb-2 flex justify-between">
            <span>Ad progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-darker-bg rounded-full h-4 mb-4">
            <div 
              className="bg-neon-green h-4 rounded-full transition-all duration-1000" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center text-sm">
            Please watch the entire ad to receive your free entry ticket.
          </p>
        </>
      )}
      
      {adCompleted && (
        <div className="text-center">
          <div className="text-neon-green text-5xl mb-4">✓</div>
          <p className="mb-4">
            Thanks for watching! You've earned a free entry ticket.
          </p>
          <button 
            onClick={() => onAdComplete()}
            className="btn-primary"
          >
            Claim Ticket & Join Tournament
          </button>
        </div>
      )}
    </div>
  );
}
