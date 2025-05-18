import React, { useState, useEffect } from 'react';
import { connectWallet } from '@/utils/web3';

// Context for managing wallet connection across the app
export const WalletContext = React.createContext({
  address: '',
  isConnected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {}
});

export function WalletProvider({ children }) {
  const [address, setAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const savedAddress = localStorage.getItem('userAddress');
      if (savedAddress) {
        setAddress(savedAddress);
        setIsConnected(true);
      }
    };

    checkConnection();
  }, []);

  // Connect wallet function
  const connect = async () => {
    try {
      setConnecting(true);
      const userAddress = await connectWallet();
      
      if (userAddress) {
        setAddress(userAddress);
        setIsConnected(true);
        localStorage.setItem('userAddress', userAddress);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect wallet function
  const disconnect = () => {
    setAddress('');
    setIsConnected(false);
    localStorage.removeItem('userAddress');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        connecting,
        connect,
        disconnect
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
