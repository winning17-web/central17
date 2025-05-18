import React, { useState, useEffect } from 'react';
import { tournamentAPI } from '@/services/api';
import { payEntryFee } from '@/utils/web3';
import TournamentCard from '@/components/TournamentCard';
import AdViewer from '@/components/AdViewer';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdViewer, setShowAdViewer] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);

  useEffect(() => {
    // Fetch tournaments when component mounts
    const fetchTournaments = async () => {
      try {
        const data = await tournamentAPI.getAll();
        setTournaments(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch tournaments:', err);
        setError('Could not load tournaments. Please try again later.');
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  const handleJoinTournament = async (tournamentId) => {
    try {
      // In a real implementation, this would connect to the wallet and call the smart contract
      const result = await payEntryFee(parseInt(tournamentId));
      
      if (result.success) {
        alert('Successfully joined tournament!');
        // Refresh tournaments or update the joined status
      }
    } catch (err) {
      console.error('Failed to join tournament:', err);
      alert('Failed to join tournament. Please try again.');
    }
  };

  const handleWatchAd = (tournamentId) => {
    setSelectedTournament(tournamentId);
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
        <h1 className="text-3xl font-bold text-white mb-8">Play+ Tournaments</h1>
        
        {loading ? (
          <p className="text-white">Loading tournaments...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                {...tournament}
                onJoin={() => handleJoinTournament(tournament.id)}
                onWatchAd={() => handleWatchAd(tournament.id)}
              />
            ))}
          </div>
        )}
        
        {showAdViewer && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="max-w-md w-full">
              <AdViewer 
                tournamentId={selectedTournament} 
                onAdComplete={handleAdComplete} 
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
