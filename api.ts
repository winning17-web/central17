// API service for connecting to backend services

// Base URL for API calls - would be environment variable in production
const API_BASE_URL = 'http://localhost:3001/api';

// Helper function for making API requests
const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Tournament related API calls
export const tournamentAPI = {
  // Get all available tournaments
  getAll: async () => {
    // For now, return mock data
    return [
      {
        id: '1',
        title: 'Weekly Battle Royale',
        game: 'Fortnite',
        entryFee: '0.01 ETH',
        prizePool: '10 ETH',
        startTime: '2025-05-20 18:00 UTC',
        playersJoined: 64,
        maxPlayers: 100,
        imageUrl: 'https://placehold.co/600x400/111/333?text=Fortnite'
      },
      {
        id: '2',
        title: 'Pro League Qualifier',
        game: 'Call of Duty',
        entryFee: '0.05 ETH',
        prizePool: '25 ETH',
        startTime: '2025-05-22 20:00 UTC',
        playersJoined: 32,
        maxPlayers: 64,
        imageUrl: 'https://placehold.co/600x400/111/333?text=Call+of+Duty'
      },
      {
        id: '3',
        title: 'Casual Friday Night',
        game: 'Apex Legends',
        entryFee: 'Free (Ad)',
        prizePool: '5 ETH',
        startTime: '2025-05-19 19:00 UTC',
        playersJoined: 45,
        maxPlayers: 60,
        imageUrl: 'https://placehold.co/600x400/111/333?text=Apex+Legends'
      }
    ];
    
    // In a real implementation:
    // return await fetchAPI('/tournaments');
  },
  
  // Get tournament details by ID
  getById: async (id: string) => {
    // For now, return mock data
    return {
      id,
      title: 'Weekly Battle Royale',
      game: 'Fortnite',
      entryFee: '0.01 ETH',
      prizePool: '10 ETH',
      startTime: '2025-05-20 18:00 UTC',
      playersJoined: 64,
      maxPlayers: 100,
      imageUrl: 'https://placehold.co/600x400/111/333?text=Fortnite',
      description: 'Join our weekly Battle Royale tournament and compete for the prize pool! Teams of 4 players will battle until only one team remains.',
      rules: 'Standard Battle Royale rules apply. No teaming with other squads. No exploits or hacks.',
      schedule: [
        { stage: 'Registration', time: '2025-05-20 16:00 UTC' },
        { stage: 'Check-in', time: '2025-05-20 17:30 UTC' },
        { stage: 'Tournament Start', time: '2025-05-20 18:00 UTC' },
        { stage: 'Finals', time: '2025-05-20 20:00 UTC' }
      ]
    };
    
    // In a real implementation:
    // return await fetchAPI(`/tournaments/${id}`);
  },
  
  // Join a tournament
  join: async (tournamentId: string, walletAddress: string) => {
    // For now, return mock data
    return {
      success: true,
      message: 'Successfully joined tournament',
      ticketId: '12345'
    };
    
    // In a real implementation:
    // return await fetchAPI(`/tournaments/${tournamentId}/join`, {
    //   method: 'POST',
    //   body: JSON.stringify({ walletAddress })
    // });
  }
};

// User related API calls
export const userAPI = {
  // Get user profile
  getProfile: async (walletAddress: string) => {
    // For now, return mock data
    return {
      address: walletAddress,
      username: walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4),
      profileImage: 'https://placehold.co/200x200/111/333?text=User',
      tournamentCount: 5,
      winCount: 2
    };
    
    // In a real implementation:
    // return await fetchAPI(`/users/${walletAddress}`);
  },
  
  // Update user profile
  updateProfile: async (walletAddress: string, data: { username?: string, profileImage?: string }) => {
    // For now, return mock data
    return {
      success: true,
      message: 'Profile updated successfully'
    };
    
    // In a real implementation:
    // return await fetchAPI(`/users/${walletAddress}`, {
    //   method: 'PUT',
    //   body: JSON.stringify(data)
    // });
  }
};

// Ad viewing related API calls
export const adAPI = {
  // Request an ad to view
  requestAd: async (tournamentId: string) => {
    // For now, return mock data
    return {
      adId: '67890',
      adUrl: 'https://placehold.co/600x400/111/333?text=Advertisement',
      duration: 30, // seconds
      tournamentId
    };
    
    // In a real implementation:
    // return await fetchAPI(`/ads/request`, {
    //   method: 'POST',
    //   body: JSON.stringify({ tournamentId })
    // });
  },
  
  // Confirm ad was viewed
  confirmView: async (adId: string, tournamentId: string, walletAddress: string) => {
    // For now, return mock data
    return {
      success: true,
      message: 'Ad view confirmed',
      ticketId: '12345'
    };
    
    // In a real implementation:
    // return await fetchAPI(`/ads/${adId}/confirm`, {
    //   method: 'POST',
    //   body: JSON.stringify({ tournamentId, walletAddress })
    // });
  }
};
