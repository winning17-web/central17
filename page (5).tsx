import React, { useState, useEffect } from 'react';
import { tournamentAPI } from '@/services/api';
import TournamentCard from '@/components/TournamentCard';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'free', 'paid'

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

  // Filter tournaments based on selected filter
  const filteredTournaments = tournaments.filter(tournament => {
    if (filter === 'all') return true;
    if (filter === 'free') return tournament.entryFee.toLowerCase().includes('free') || tournament.entryFee.toLowerCase().includes('ad');
    if (filter === 'paid') return !tournament.entryFee.toLowerCase().includes('free') && !tournament.entryFee.toLowerCase().includes('ad');
    return true;
  });

  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">All Tournaments</h1>
        
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-md overflow-hidden">
            <button
              className={`px-6 py-2 ${filter === 'all' ? 'bg-electric-blue text-black' : 'bg-darker-bg text-white'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`px-6 py-2 ${filter === 'free' ? 'bg-electric-blue text-black' : 'bg-darker-bg text-white'}`}
              onClick={() => setFilter('free')}
            >
              Free (Ad)
            </button>
            <button
              className={`px-6 py-2 ${filter === 'paid' ? 'bg-electric-blue text-black' : 'bg-darker-bg text-white'}`}
              onClick={() => setFilter('paid')}
            >
              Paid
            </button>
          </div>
        </div>
        
        {loading ? (
          <p className="text-white">Loading tournaments...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.length > 0 ? (
              filteredTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  {...tournament}
                />
              ))
            ) : (
              <p className="text-white col-span-3 text-center">No tournaments found matching your filter.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
