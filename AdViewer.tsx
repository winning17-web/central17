import React, { useState } from 'react';

interface AdViewerProps {
  onAdComplete: () => void;
  tournamentId: string;
}

export default function AdViewer({ onAdComplete, tournamentId }: AdViewerProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [adCompleted, setAdCompleted] = useState(false);
  
  const startWatchingAd = () => {
    setIsWatching(true);
    
    // Simulate ad watching progress
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 10;
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setAdCompleted(true);
          return 100;
        }
        
        return newProgress;
      });
    }, 1000);
  };
  
  const claimTicket = () => {
    onAdComplete();
  };
  
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
        <div>
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
        </div>
      )}
      
      {adCompleted && (
        <div className="text-center">
          <div className="text-neon-green text-5xl mb-4">✓</div>
          <p className="mb-4">
            Thanks for watching! You've earned a free entry ticket.
          </p>
          <button 
            onClick={claimTicket}
            className="btn-primary"
          >
            Claim Ticket & Join Tournament
          </button>
        </div>
      )}
    </div>
  );
}
