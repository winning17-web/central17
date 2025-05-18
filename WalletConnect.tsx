import React, { useState } from 'react';

interface WalletConnectProps {
  onConnect: (address: string) => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  
  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      // This is a placeholder for actual Web3 wallet connection
      // In a real implementation, we would use ethers.js or web3.js
      // to connect to MetaMask or other wallets
      
      setTimeout(() => {
        // Mock successful connection with a sample address
        const mockAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        onConnect(mockAddress);
        setIsConnecting(false);
      }, 1000);
      
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setIsConnecting(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center">
      <button 
        onClick={connectWallet}
        disabled={isConnecting}
        className={`btn-primary w-full max-w-xs ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      
      <p className="mt-4 text-sm text-text-secondary text-center">
        Connect your wallet to join tournaments, claim rewards, and track your progress.
      </p>
    </div>
  );
}
