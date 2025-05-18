import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { tournamentAPI } from '@/services/api';
import { payEntryFee } from '@/utils/web3';
import AdViewer from '@/components/AdViewer';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params?.id;
  
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdViewer, setShowAdViewer] = useState(false);

  useEffect(() => {
    // Fetch tournament details when component mounts
    const fetchTournamentDetails = async () => {
      if (!tournamentId) return;
      
      try {
        const data = await tournamentAPI.getById(tournamentId);
        setTournament(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch tournament details:', err);
        setError('Could not load tournament details. Please try again later.');
        setLoading(false);
      }
    };

    fetchTournamentDetails();
  }, [tournamentId]);

  const handleJoinTournament = async () => {
    try {
      // In a real implementation, this would connect to the wallet and call the smart contract
      const result = await payEntryFee(parseInt(tournamentId));
      
      if (result.success) {
        alert('Successfully joined tournament!');
        // Refresh tournament data or update the joined status
      }
    } catch (err) {
      console.error('Failed to join tournament:', err);
      alert('Failed to join tournament. Please try again.');
    }
  };

  const handleWatchAd = () => {
    setShowAdViewer(true);
  };

  const handleAdComplete = () => {
    alert('Successfully joined tournament with ad ticket!');
    setShowAdViewer(false);
    // In a real implementation, we would update the UI to reflect the new ticket
  };

  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <p className="text-white">Loading tournament details...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : tournament ? (
          <div>
            <div className="relative h-64 mb-6 rounded-lg overflow-hidden">
              <img 
                src={tournament.imageUrl} 
                alt={tournament.game} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-bg to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6">
                <span className="bg-electric-blue text-black px-3 py-1 rounded-full text-sm font-medium mb-2 inline-block">
                  {tournament.game}
                </span>
                <h1 className="text-3xl font-bold text-white">{tournament.title}</h1>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card">
                <h2 className="subheader">Tournament Details</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-text-secondary">Entry Fee</p>
                    <p className="text-gold font-medium">{tournament.entryFee}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Prize Pool</p>
                    <p className="text-electric-blue font-medium">{tournament.prizePool}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Start Time</p>
                    <p className="text-white">{tournament.startTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Players</p>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{tournament.playersJoined}/{tournament.maxPlayers}</span>
                    </div>
                    <div className="w-full bg-darker-bg rounded-full h-2">
                      <div 
                        className="bg-neon-green h-2 rounded-full" 
                        style={{ width: `${(tournament.playersJoined / tournament.maxPlayers) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card md:col-span-2">
                <h2 className="subheader">Description</h2>
                <p className="mb-4 text-text-primary">{tournament.description}</p>
                
                <h2 className="subheader mt-6">Rules</h2>
                <p className="mb-4 text-text-primary">{tournament.rules}</p>
                
                <h2 className="subheader mt-6">Schedule</h2>
                <div className="space-y-2">
                  {tournament.schedule.map((item, index) => (
                    <div key={index} className="flex justify-between border-b border-[#333333] pb-2">
                      <span className="text-text-primary">{item.stage}</span>
                      <span className="text-electric-blue">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button 
                onClick={handleJoinTournament}
                className="btn-primary px-8 py-3"
              >
                Join Tournament ({tournament.entryFee})
              </button>
              <button 
                onClick={handleWatchAd}
                className="btn-gold px-8 py-3"
              >
                Watch Ad to Join Free
              </button>
            </div>
          </div>
        ) : (
          <p className="text-white">Tournament not found</p>
        )}
        
        {showAdViewer && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="max-w-md w-full">
              <AdViewer 
                tournamentId={tournamentId} 
                onAdComplete={handleAdComplete} 
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
