import React from 'react';

interface UserProfileProps {
  address: string;
  username?: string;
  profileImage?: string;
  tournamentCount?: number;
  winCount?: number;
}

export default function UserProfile({
  address,
  username = 'Anonymous Player',
  profileImage = '/images/default-avatar.png',
  tournamentCount = 0,
  winCount = 0
}: UserProfileProps) {
  // Format the wallet address for display (0x1234...5678)
  const formattedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  
  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-darker-bg overflow-hidden">
          {profileImage && (
            <img 
              src={profileImage} 
              alt={username} 
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-white">{username}</h2>
          <p className="text-sm text-text-secondary">{formattedAddress}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-darker-bg p-3 rounded text-center">
          <p className="text-sm text-text-secondary">Tournaments</p>
          <p className="text-xl font-bold text-electric-blue">{tournamentCount}</p>
        </div>
        <div className="bg-darker-bg p-3 rounded text-center">
          <p className="text-sm text-text-secondary">Wins</p>
          <p className="text-xl font-bold text-neon-green">{winCount}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <button className="btn-primary w-full">Edit Profile</button>
        <button className="btn-gold w-full">View NFT Tickets</button>
      </div>
    </div>
  );
}
