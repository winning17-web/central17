import React, { useState, useEffect } from 'react';
import { tournamentAPI } from '@/services/api';
import { claimReward } from '@/utils/web3';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFrame, setTimeFrame] = useState('weekly'); // 'weekly' or 'instant'

  useEffect(() => {
    // Fetch leaderboard data when component mounts or timeFrame changes
    const fetchLeaderboard = async () => {
      try {
        // In a real implementation, this would call the backend API
        // const data = await leaderboardAPI.getLeaderboard(timeFrame);
        
        // Mock data for now
        const mockData = timeFrame === 'weekly' ? [
          { rank: 1, username: 'ProGamer123', walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', wins: 12, earnings: '45 ETH', avatar: 'https://placehold.co/100x100/111/333?text=1' },
          { rank: 2, username: 'BattleKing', walletAddress: '0x8c1eD7e19abAa9f23c476dA86Dc1577F1Ef401f5', wins: 10, earnings: '38 ETH', avatar: 'https://placehold.co/100x100/111/333?text=2' },
          { rank: 3, username: 'GameMaster', walletAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', wins: 8, earnings: '30 ETH', avatar: 'https://placehold.co/100x100/111/333?text=3' },
          { rank: 4, username: 'VictoryRoyal', walletAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', wins: 7, earnings: '25 ETH', avatar: 'https://placehold.co/100x100/111/333?text=4' },
          { rank: 5, username: 'EliteSniper', walletAddress: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', wins: 6, earnings: '20 ETH', avatar: 'https://placehold.co/100x100/111/333?text=5' },
        ] : [
          { rank: 1, username: 'TacticalPlayer', walletAddress: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', wins: 3, earnings: '15 ETH', avatar: 'https://placehold.co/100x100/111/333?text=1' },
          { rank: 2, username: 'QuickShot', walletAddress: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', wins: 2, earnings: '10 ETH', avatar: 'https://placehold.co/100x100/111/333?text=2' },
          { rank: 3, username: 'StealthMaster', walletAddress: '0xBcd4042DE499D14e55001CcbB24a551F3b954096', wins: 2, earnings: '8 ETH', avatar: 'https://placehold.co/100x100/111/333?text=3' },
          { rank: 4, username: 'SniperElite', walletAddress: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788', wins: 1, earnings: '5 ETH', avatar: 'https://placehold.co/100x100/111/333?text=4' },
          { rank: 5, username: 'BattleHero', walletAddress: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', wins: 1, earnings: '3 ETH', avatar: 'https://placehold.co/100x100/111/333?text=5' },
        ];
        
        setLeaderboard(mockData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setError('Could not load leaderboard. Please try again later.');
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeFrame]);

  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Leaderboard</h1>
        
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-md overflow-hidden">
            <button
              className={`px-6 py-2 ${timeFrame === 'weekly' ? 'bg-electric-blue text-black' : 'bg-darker-bg text-white'}`}
              onClick={() => setTimeFrame('weekly')}
            >
              Weekly
            </button>
            <button
              className={`px-6 py-2 ${timeFrame === 'instant' ? 'bg-electric-blue text-black' : 'bg-darker-bg text-white'}`}
              onClick={() => setTimeFrame('instant')}
            >
              Instant Tournaments
            </button>
          </div>
        </div>
        
        {loading ? (
          <p className="text-white">Loading leaderboard...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-darker-bg">
                  <th className="p-4 text-left text-white">Rank</th>
                  <th className="p-4 text-left text-white">Player</th>
                  <th className="p-4 text-left text-white">Wins</th>
                  <th className="p-4 text-left text-white">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player) => (
                  <tr key={player.rank} className="border-b border-[#333333]">
                    <td className="p-4">
                      <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center font-bold ${player.rank <= 3 ? 'bg-gold text-black' : 'bg-darker-bg text-white'}`}>
                        {player.rank}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={player.avatar} 
                          alt={player.username} 
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-white">{player.username}</p>
                          <p className="text-xs text-text-secondary">{`${player.walletAddress.substring(0, 6)}...${player.walletAddress.substring(player.walletAddress.length - 4)}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-neon-green font-medium">{player.wins}</td>
                    <td className="p-4 text-electric-blue font-medium">{player.earnings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
