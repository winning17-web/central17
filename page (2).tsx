import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { userAPI } from '@/services/api';
import { connectWallet, getUserTickets } from '@/utils/web3';
import UserProfile from '@/components/UserProfile';

export default function ProfilePage() {
  const router = useRouter();
  const [userAddress, setUserAddress] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is connected
    const checkConnection = async () => {
      try {
        // In a real implementation, this would check local storage or a state management solution
        // for an existing connection before prompting the user
        const address = localStorage.getItem('userAddress');
        
        if (address) {
          setUserAddress(address);
          await fetchUserData(address);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Connection check failed:', err);
        setError('Failed to check wallet connection');
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  const fetchUserData = async (address) => {
    try {
      setLoading(true);
      
      // Fetch user profile and tickets in parallel
      const [profile, tickets] = await Promise.all([
        userAPI.getProfile(address),
        getUserTickets(address)
      ]);
      
      setUserProfile(profile);
      setUserTickets(tickets);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      setError('Could not load user data. Please try again later.');
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const address = await connectWallet();
      
      if (address) {
        setUserAddress(address);
        localStorage.setItem('userAddress', address);
        await fetchUserData(address);
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
      setError('Failed to connect wallet. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Your Profile</h1>
        
        {loading ? (
          <p className="text-white">Loading profile...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : !userAddress ? (
          <div className="card p-6 max-w-md mx-auto">
            <h2 className="header text-center">Connect Your Wallet</h2>
            <p className="mb-6 text-center">
              Connect your wallet to view your profile, tournament history, and NFT tickets.
            </p>
            <button 
              onClick={handleConnect}
              className="btn-primary w-full"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              {userProfile && (
                <UserProfile
                  address={userAddress}
                  username={userProfile.username}
                  profileImage={userProfile.profileImage}
                  tournamentCount={userProfile.tournamentCount}
                  winCount={userProfile.winCount}
                />
              )}
            </div>
            
            <div className="md:col-span-2">
              <div className="card p-6">
                <h2 className="header">Your NFT Tickets</h2>
                
                {userTickets.length === 0 ? (
                  <p className="text-text-secondary">
                    You don't have any NFT tickets yet. Join a tournament to get started!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {userTickets.map((ticket) => (
                      <div key={ticket.id} className="bg-darker-bg rounded-lg p-3 border border-[#333333]">
                        <div className="h-32 mb-2 overflow-hidden rounded">
                          <img 
                            src={ticket.imageUrl || "https://placehold.co/400x200/111/333?text=NFT+Ticket"} 
                            alt={`Ticket for ${ticket.tournamentName}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="font-medium text-white">{ticket.tournamentName}</h3>
                        <p className="text-sm text-text-secondary">Ticket #{ticket.id}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
