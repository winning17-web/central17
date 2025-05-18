import React from 'react';

interface TournamentCardProps {
  id: string;
  title: string;
  game: string;
  entryFee: string;
  prizePool: string;
  startTime: string;
  playersJoined: number;
  maxPlayers: number;
  imageUrl: string;
}

export default function TournamentCard({
  id,
  title,
  game,
  entryFee,
  prizePool,
  startTime,
  playersJoined,
  maxPlayers,
  imageUrl
}: TournamentCardProps) {
  return (
    <div className="card hover:border-electric-blue transition-colors">
      <div className="relative h-40 mb-3 overflow-hidden rounded">
        <img 
          src={imageUrl} 
          alt={`${game} tournament`} 
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-darker-bg to-transparent p-2">
          <span className="text-neon-green font-bold">{game}</span>
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      
      <div className="flex justify-between mb-3">
        <div>
          <p className="text-sm text-text-secondary">Entry Fee</p>
          <p className="text-gold font-medium">{entryFee}</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">Prize Pool</p>
          <p className="text-electric-blue font-medium">{prizePool}</p>
        </div>
      </div>
      
      <div className="mb-3">
        <p className="text-sm text-text-secondary">Starts</p>
        <p className="text-white">{startTime}</p>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Players</span>
          <span>{playersJoined}/{maxPlayers}</span>
        </div>
        <div className="w-full bg-darker-bg rounded-full h-2">
          <div 
            className="bg-neon-green h-2 rounded-full" 
            style={{ width: `${(playersJoined / maxPlayers) * 100}%` }}
          ></div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button className="btn-primary flex-1">Join</button>
        <button className="btn-gold flex-1">Watch Ad to Join</button>
      </div>
    </div>
  );
}
