/**
 * Telegram Mini App for Web3 Game Tournament
 * 
 * This file contains the core logic for the mini app, handling:
 * - Telegram WebApp integration
 * - Screen navigation
 * - Tournament management
 * - Ad viewing and credit tracking
 * - Match result submission
 */

// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Set theme colors
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
document.documentElement.style.setProperty('--tg-theme-text-color', tg.textColor);
document.documentElement.style.setProperty('--tg-theme-hint-color', tg.hint_color || '#999999');
document.documentElement.style.setProperty('--tg-theme-link-color', tg.link_color || '#2481cc');
document.documentElement.style.setProperty('--tg-theme-button-color', tg.button_color || '#2481cc');
document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.button_text_color || '#ffffff');

// API endpoints
const API_BASE_URL = 'https://your-server.com/api';
const API_ENDPOINTS = {
    TOURNAMENTS: `${API_BASE_URL}/tournaments`,
    MATCHES: `${API_BASE_URL}/matches`,
    AD_VIEW: `${API_BASE_URL}/ad-view`,
    USER_PROFILE: `${API_BASE_URL}/user`,
    CREDITS: `${API_BASE_URL}/credits`,
};

// App state
const state = {
    user: {
        id: tg.initDataUnsafe?.user?.id || 0,
        username: tg.initDataUnsafe?.user?.username || 'User',
        credits: 0,
        tournaments: [],
        matches: []
    },
    tournaments: [],
    currentTournament: null,
    currentMatch: null,
    adViewing: {
        type: null,
        startTime: null,
        duration: 0,
        completed: false
    },
    screens: {
        current: 'loading',
        history: []
    }
};

// DOM Elements
const screens = {
    loading: document.getElementById('loading'),
    mainMenu: document.getElementById('main-menu'),
    tournaments: document.getElementById('tournaments-screen'),
    tournamentDetails: document.getElementById('tournament-details'),
    adScreen: document.getElementById('ad-screen'),
    adViewer: document.getElementById('ad-viewer'),
    matches: document.getElementById('matches-screen'),
    matchDetails: document.getElementById('match-details'),
    profile: document.getElementById('profile-screen')
};

// Initialize app
async function initApp() {
    try {
        // Show loading screen
        showScreen('loading');
        
        // Check if we have a start parameter for ad viewing
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('watch_ad_')) {
            const parts = startParam.split('_');
            const adType = parts[2];
            await handleAdView(adType);
        }
        
        // Load user data
        await loadUserData();
        
        // Update UI with user data
        updateUserUI();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show main menu
        showScreen('mainMenu');
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Failed to initialize app. Please try again.');
    }
}

// Load user data from server or Telegram storage
async function loadUserData() {
    try {
        // Try to get data from Telegram CloudStorage first
        if (tg.CloudStorage) {
            const creditsStr = await tg.CloudStorage.getItem('total_ad_credits');
            if (creditsStr) {
                state.user.credits = parseInt(creditsStr, 10);
            }
        }
        
        // If we have a user ID, fetch data from server
        if (state.user.id) {
            const response = await fetch(`${API_ENDPOINTS.USER_PROFILE}/${state.user.id}`);
            if (response.ok) {
                const userData = await response.json();
                state.user = {
                    ...state.user,
                    ...userData
                };
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        // Continue with default values if loading fails
    }
}

// Update UI with user data
function updateUserUI() {
    // Update username
    document.getElementById('username').textContent = state.user.username;
    document.getElementById('profile-name').textContent = state.user.username;
    
    // Update credit amount
    document.getElementById('credit-amount').textContent = state.user.credits;
    document.getElementById('profile-credits').textContent = state.user.credits;
    
    // Update profile stats
    document.getElementById('tournaments-joined').textContent = state.user.tournaments?.length || 0;
    document.getElementById('matches-won').textContent = state.user.matches?.filter(m => m.result === 'win')?.length || 0;
    document.getElementById('matches-lost').textContent = state.user.matches?.filter(m => m.result === 'loss')?.length || 0;
}

// Set up event listeners
function setupEventListeners() {
    // Main menu buttons
    document.getElementById('tournaments-btn').addEventListener('click', () => {
        loadTournaments();
        showScreen('tournaments');
    });
    
    document.getElementById('watch-ads-btn').addEventListener('click', () => {
        loadAdHistory();
        showScreen('adScreen');
    });
    
    document.getElementById('my-matches-btn').addEventListener('click', () => {
        loadMatches();
        showScreen('matches');
    });
    
    document.getElementById('profile-btn').addEventListener('click', () => {
        loadTransactionHistory();
        showScreen('profile');
    });
    
    // Back buttons
    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', () => {
            navigateBack();
        });
    });
    
    // Ad option buttons
    document.querySelectorAll('.ad-option .watch-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const adType = e.target.closest('.ad-option').dataset.type;
            startAdViewing(adType);
        });
    });
    
    // Ad completion button
    document.getElementById('ad-done-btn').addEventListener('click', () => {
        showScreen('adScreen');
    });
    
    // Tournament tabs
    document.querySelectorAll('#tournaments-screen .tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.target.dataset.tab;
            activateTab(e.target);
            filterTournaments(tabType);
        });
    });
    
    // Match tabs
    document.querySelectorAll('#matches-screen .tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.target.dataset.tab;
            activateTab(e.target);
            filterMatches(tabType);
        });
    });
    
    // Create tournament button
    document.querySelector('.create-tournament-btn').addEventListener('click', () => {
        // In a real app, show a form to create tournament
        tg.showAlert('Tournament creation is not available in this demo.');
    });
    
    // Join tournament button
    document.getElementById('join-tournament-btn').addEventListener('click', () => {
        joinTournament(state.currentTournament.id);
    });
    
    // Result submission
    document.querySelectorAll('.result-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.result-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });
    
    document.getElementById('submit-result-btn').addEventListener('click', () => {
        const selectedOption = document.querySelector('.result-option.selected');
        if (selectedOption) {
            submitMatchResult(state.currentMatch.id, selectedOption.dataset.result);
        } else {
            tg.showAlert('Please select a result.');
        }
    });
    
    // Upload evidence button
    document.getElementById('upload-evidence').addEventListener('click', () => {
        // In a real app, implement file upload
        tg.showAlert('Screenshot upload is not available in this demo.');
    });
}

// Show a specific screen
function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show the requested screen
    screens[screenName].classList.remove('hidden');
    
    // Update screen history for back navigation
    if (state.screens.current !== screenName) {
        state.screens.history.push(state.screens.current);
        state.screens.current = screenName;
    }
}

// Navigate back to previous screen
function navigateBack() {
    if (state.screens.history.length > 0) {
        const previousScreen = state.screens.history.pop();
        state.screens.current = previousScreen;
        screens[previousScreen].classList.remove('hidden');
        Object.entries(screens).forEach(([name, screen]) => {
            if (name !== previousScreen) {
                screen.classList.add('hidden');
            }
        });
    } else {
        showScreen('mainMenu');
    }
}

// Activate a tab
function activateTab(tabElement) {
    const tabContainer = tabElement.parentElement;
    tabContainer.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    tabElement.classList.add('active');
}

// Load tournaments
async function loadTournaments() {
    try {
        const response = await fetch(API_ENDPOINTS.TOURNAMENTS);
        if (response.ok) {
            state.tournaments = await response.json();
        } else {
            // For demo, use mock data if API fails
            state.tournaments = getMockTournaments();
        }
        renderTournaments('active');
    } catch (error) {
        console.error('Error loading tournaments:', error);
        state.tournaments = getMockTournaments();
        renderTournaments('active');
    }
}

// Filter tournaments by status
function filterTournaments(status) {
    renderTournaments(status);
}

// Render tournaments to the UI
function renderTournaments(status) {
    const container = document.getElementById('tournament-container');
    container.innerHTML = '';
    
    const filteredTournaments = state.tournaments.filter(t => {
        if (status === 'active') return t.status === 'active';
        if (status === 'upcoming') return t.status === 'created';
        if (status === 'completed') return t.status === 'completed';
        return true;
    });
    
    if (filteredTournaments.length === 0) {
        container.innerHTML = '<div class="empty-state">No tournaments found</div>';
        return;
    }
    
    filteredTournaments.forEach(tournament => {
        const card = document.createElement('div');
        card.className = 'tournament-card';
        card.innerHTML = `
            <div class="tournament-card-header">
                <h3>${tournament.name}</h3>
                <span class="tournament-status status-${tournament.status}">${tournament.status}</span>
            </div>
            <div class="tournament-card-details">
                <span>${tournament.participants.length}/${tournament.maxParticipants} players</span>
                <span>${tournament.entryPrice} ⭐</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            viewTournamentDetails(tournament.id);
        });
        
        container.appendChild(card);
    });
}

// View tournament details
async function viewTournamentDetails(tournamentId) {
    try {
        // Find tournament in state or fetch from API
        let tournament = state.tournaments.find(t => t.id === tournamentId);
        
        if (!tournament) {
            const response = await fetch(`${API_ENDPOINTS.TOURNAMENTS}/${tournamentId}`);
            if (response.ok) {
                tournament = await response.json();
            } else {
                throw new Error('Tournament not found');
            }
        }
        
        state.currentTournament = tournament;
        
        // Update UI
        document.getElementById('tournament-name').textContent = tournament.name;
        document.getElementById('tournament-status').textContent = tournament.status;
        document.getElementById('tournament-fee').textContent = `${tournament.entryPrice} ⭐`;
        document.getElementById('tournament-participants').textContent = `${tournament.participants.length}/${tournament.maxParticipants}`;
        document.getElementById('tournament-start').textContent = new Date(tournament.startTime).toLocaleDateString();
        document.getElementById('tournament-description').textContent = tournament.description;
        
        // Render matches
        const matchesContainer = document.getElementById('tournament-matches');
        matchesContainer.innerHTML = '';
        
        if (tournament.matches && tournament.matches.length > 0) {
            tournament.matches.forEach(match => {
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card';
                matchCard.innerHTML = `
                    <div class="match-players">
                        <div class="player player1">
                            <div class="player-avatar">👤</div>
                            <div class="player-name">Player ${match.player1}</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="player player2">
                            <div class="player-avatar">👤</div>
                            <div class="player-name">Player ${match.player2}</div>
                        </div>
                    </div>
                    <div class="match-status">${match.status}</div>
                `;
                
                matchCard.addEventListener('click', () => {
                    viewMatchDetails(match.id);
                });
                
                matchesContainer.appendChild(matchCard);
            });
        } else {
            matchesContainer.innerHTML = '<div class="empty-state">No matches available</div>';
        }
        
        // Update join button
        const joinButton = document.getElementById('join-tournament-btn');
        if (tournament.status !== 'created') {
            joinButton.disabled = true;
            joinButton.textContent = tournament.status === 'active' ? 'Tournament in progress' : 'Tournament ended';
        } else if (tournament.participants.includes(state.user.id)) {
            joinButton.disabled = true;
            joinButton.textContent = 'Already joined';
        } else if (tournament.participants.length >= tournament.maxParticipants) {
            joinButton.disabled = true;
            joinButton.textContent = 'Tournament full';
        } else if (state.user.credits < tournament.entryPrice) {
            joinButton.disabled = true;
            joinButton.textContent = 'Not enough credits';
        } else {
            joinButton.disabled = false;
            joinButton.textContent = 'Join Tournament';
        }
        
        showScreen('tournamentDetails');
    } catch (error) {
        console.error('Error viewing tournament details:', error);
        tg.showAlert('Failed to load tournament details.');
    }
}

// Join a tournament
async function joinTournament(tournamentId) {
    try {
        const tournament = state.tournaments.find(t => t.id === tournamentId);
        
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        if (state.user.credits < tournament.entryPrice) {
            tg.showAlert('Not enough credits to join this tournament.');
            return;
        }
        
        // In a real app, make API call to join tournament
        // For demo, simulate joining
        state.user.credits -= tournament.entryPrice;
        tournament.participants.push(state.user.id);
        state.user.tournaments.push(tournamentId);
        
        // Update storage
        if (tg.CloudStorage) {
            await tg.CloudStorage.setItem('total_ad_credits', state.user.credits.toString());
        }
        
        // Update UI
        updateUserUI();
        viewTournamentDetails(tournamentId);
        
        tg.showPopup({
            title: 'Success',
            message: `You have joined the tournament "${tournament.name}"!`,
            buttons: [{type: 'ok'}]
        });
    } catch (error) {
        console.error('Error joining tournament:', error);
        tg.showAlert('Failed to join tournament.');
    }
}

// Load matches
async function loadMatches() {
    try {
        const response = await fetch(`${API_ENDPOINTS.MATCHES}?userId=${state.user.id}`);
        if (response.ok) {
            state.user.matches = await response.json();
        } else {
            // For demo, use mock data if API fails
            state.user.matches = getMockMatches();
        }
        renderMatches('upcoming');
    } catch (error) {
        console.error('Error loading matches:', error);
        state.user.matches = getMockMatches();
        renderMatches('upcoming');
    }
}

// Filter matches by status
function filterMatches(status) {
    renderMatches(status);
}

// Render matches to the UI
function renderMatches(status) {
    const container = document.getElementById('match-container');
    container.innerHTML = '';
    
    const filteredMatches = state.user.matches.filter(m => {
        if (status === 'upcoming') return m.status === 'scheduled' || m.status === 'active';
        if (status === 'completed') return m.status === 'completed';
        return true;
    });
    
    if (filteredMatches.length === 0) {
        container.innerHTML = '<div class="empty-state">No matches found</div>';
        return;
    }
    
    filteredMatches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="match-players">
                <div class="player player1">
                    <div class="player-avatar">👤</div>
                    <div class="player-name">Player ${match.player1}</div>
                </div>
                <div class="vs">VS</div>
                <div class="player player2">
                    <div class="player-avatar">👤</div>
                    <div class="player-name">Player ${match.player2}</div>
                </div>
            </div>
            <div class="match-status">${match.status}</div>
        `;
        
        card.addEventListener('click', () => {
            viewMatchDetails(match.id);
        });
        
        container.appendChild(card);
    });
}

// View match details
async function viewMatchDetails(matchId) {
    try {
        // Find match in state or fetch from API
        let match = state.user.matches.find(m => m.id === matchId);
        
        if (!match) {
            const response = await fetch(`${API_ENDPOINTS.MATCHES}/${matchId}`);
            if (response.ok) {
                match = await response.json();
            } else {
                throw new Error('Match not found');
            }
        }
        
        state.currentMatch = match;
        
        // Update UI
        document.getElementById('player1-name').textContent = `Player ${match.player1}`;
        document.getElementById('player2-name').textContent = `Player ${match.player2}`;
        document.getElementById('match-status').textContent = match.status;
        
        // Show/hide result section
        const resultSection = document.getElementById('match-result');
        if (match.result) {
            resultSection.classList.remove('hidden');
            document.getElementById('result-value').textContent = match.result;
        } else {
            resultSection.classList.add('hidden');
        }
        
        // Show/hide submit result section
        const submitResultSection = document.getElementById('submit-result-section');
        if (match.status === 'active' && (match.player1 === state.user.id || match.player2 === state.user.id)) {
            submitResultSection.classList.remove('hidden');
        } else {
            submitResultSection.classList.add('hidden');
        }
        
        showScreen('matchDetails');
    } catch (error) {
        console.error('Error viewing match details:', error);
        tg.showAlert('Failed to load match details.');
    }
}

// Submit match result
async function submitMatchResult(matchId, result) {
    try {
        // In a real app, make API call to submit result
        // For demo, simulate submission
        const match = state.user.matches.find(m => m.id === matchId);
        
        if (!match) {
            throw new Error('Match not found');
        }
        
        match.status = 'completed';
        match.result = result;
        
        tg.showPopup({
            title: 'Result Submitted',
            message: 'Your match result has been submitted and is awaiting confirmation from your opponent.',
            buttons: [{type: 'ok'}]
        });
        
        showScreen('matches');
        renderMatches('completed');
    } catch (error) {
        console.error('Error submitting match result:', error);
        tg.showAlert('Failed to submit match result.');
    }
}

// Start ad viewing
function startAdViewing(adType) {
    state.adViewing = {
        type: adType,
        startTime: Date.now(),
        duration: getAdDuration(adType),
        completed: false
    };
    
    // Show ad viewer screen
    showScreen('adViewer');
    
    // Set up ad container
    const adContainer = document.getElementById('ad-container');
    adContainer.innerHTML = `<div>Simulated ${adType} Advertisement</div>`;
    
    // Set up progress bar
    const progressFill = document.getElementById('ad-progress-fill');
    const timeRemaining = document.getElementById('ad-time-remaining');
    
    // Start progress timer
    let elapsed = 0;
    const duration = state.adViewing.duration;
    timeRemaining.textContent = Math.ceil(duration / 1000);
    
    const progressInterval = setInterval(() => {
        elapsed += 100;
        const progress = (elapsed / duration) * 100;
        progressFill.style.width = `${Math.min(progress, 100)}%`;
        timeRemaining.textContent = Math.ceil((duration - elapsed) / 1000);
        
        if (elapsed >= duration) {
            clearInterval(progressInterval);
            completeAdViewing();
        }
    }, 100);
}

// Complete ad viewing
async function completeAdViewing() {
    try {
        state.adViewing.completed = true;
        
        // Show completion message
        document.getElementById('ad-completion').classList.remove('hidden');
        
        // Calculate earned credits
        const credits = getCreditsForAdType(state.adViewing.type);
        document.getElementById('earned-credits').textContent = credits;
        
        // In a real app, make API call to record ad view
        // For demo, simulate recording
        state.user.credits += credits;
        
        // Update storage
        if (tg.CloudStorage) {
            await tg.CloudStorage.setItem('total_ad_credits', state.user.credits.toString());
        }
        
        // Update UI
        updateUserUI();
    } catch (error) {
        console.error('Error completing ad view:', error);
        tg.showAlert('Failed to record ad view.');
    }
}

// Handle ad view from start parameter
async function handleAdView(adType) {
    try {
        // Calculate earned credits
        const credits = getCreditsForAdType(adType);
        
        // In a real app, make API call to record ad view
        // For demo, simulate recording
        state.user.credits += credits;
        
        // Update storage
        if (tg.CloudStorage) {
            await tg.CloudStorage.setItem('total_ad_credits', state.user.credits.toString());
        }
        
        // Show success message
        tg.showPopup({
            title: 'Ad Viewed',
            message: `Thank you for watching the ad! You earned ${credits} credits.`,
            buttons: [{type: 'ok'}]
        });
    } catch (error) {
        console.error('Error handling ad view:', error);
    }
}

// Get ad duration in milliseconds
function getAdDuration(adType) {
    switch (adType) {
        case 'short':
            return 15000; // 15 seconds
        case 'medium':
            return 30000; // 30 seconds
        case 'long':
            return 60000; // 60 seconds
        default:
            return 15000;
    }
}

// Get credits for ad type
function getCreditsForAdType(adType) {
    switch (adType) {
        case 'short':
            return 5;
        case 'medium':
            return 10;
        case 'long':
            return 20;
        default:
            return 5;
    }
}

// Load ad history
function loadAdHistory() {
    // In a real app, fetch ad history from API
    // For demo, use mock data
    const adHistory = getMockAdHistory();
    renderAdHistory(adHistory);
}

// Render ad history
function renderAdHistory(history) {
    const container = document.getElementById('ad-history-list');
    container.innerHTML = '';
    
    if (history.length === 0) {
        container.innerHTML = '<div class="empty-state">No ad history</div>';
        return;
    }
    
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'ad-history-item';
        historyItem.innerHTML = `
            <span>${item.adType} Ad</span>
            <span>+${item.credits} ⭐</span>
        `;
        container.appendChild(historyItem);
    });
}

// Load transaction history
function loadTransactionHistory() {
    // In a real app, fetch transaction history from API
    // For demo, use mock data
    const transactions = getMockTransactions();
    renderTransactions(transactions);
}

// Render transactions
function renderTransactions(transactions) {
    const container = document.getElementById('transaction-list');
    container.innerHTML = '';
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">No transactions</div>';
        return;
    }
    
    transactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        
        let amountText = '';
        if (transaction.type === 'ad_view') {
            amountText = `+${transaction.amount} ⭐`;
        } else if (transaction.type === 'tournament_entry') {
            amountText = `-${transaction.amount} ⭐`;
        }
        
        transactionItem.innerHTML = `
            <span class="transaction-type">${formatTransactionType(transaction.type)}</span>
            <span>${amountText}</span>
        `;
        container.appendChild(transactionItem);
    });
}

// Format transaction type
function formatTransactionType(type) {
    switch (type) {
        case 'ad_view':
            return 'Ad View';
        case 'tournament_entry':
            return 'Tournament Entry';
        default:
            return type;
    }
}

// Mock data functions
function getMockTournaments() {
    return [
        {
            id: 'tournament_1',
            name: 'Weekly Challenge',
            description: 'Compete in our weekly tournament for a chance to win prizes!',
            status: 'created',
            entryPrice: 10,
            maxParticipants: 16,
            participants: [123456, 789012],
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            matches: []
        },
        {
            id: 'tournament_2',
            name: 'Pro League',
            description: 'High stakes tournament for experienced players.',
            status: 'active',
            entryPrice: 20,
            maxParticipants: 8,
            participants: [123456, 789012, 345678, 901234],
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            matches: [
                {
                    id: 'match_1',
                    tournamentId: 'tournament_2',
                    player1: 123456,
                    player2: 789012,
                    status: 'scheduled'
                },
                {
                    id: 'match_2',
                    tournamentId: 'tournament_2',
                    player1: 345678,
                    player2: 901234,
                    status: 'scheduled'
                }
            ]
        },
        {
            id: 'tournament_3',
            name: 'Championship',
            description: 'The ultimate test of skill and strategy.',
            status: 'completed',
            entryPrice: 30,
            maxParticipants: 4,
            participants: [123456, 789012, 345678, 901234],
            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            matches: []
        }
    ];
}

function getMockMatches() {
    return [
        {
            id: 'match_1',
            tournamentId: 'tournament_2',
            player1: state.user.id,
            player2: 789012,
            status: 'scheduled'
        },
        {
            id: 'match_3',
            tournamentId: 'tournament_3',
            player1: state.user.id,
            player2: 345678,
            status: 'completed',
            result: 'win'
        }
    ];
}

function getMockAdHistory() {
    return [
        {
            adType: 'medium',
            credits: 10,
            timestamp: Date.now() - 2 * 60 * 60 * 1000
        },
        {
            adType: 'short',
            credits: 5,
            timestamp: Date.now() - 24 * 60 * 60 * 1000
        },
        {
            adType: 'long',
            credits: 20,
            timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000
        }
    ];
}

function getMockTransactions() {
    return [
        {
            type: 'ad_view',
            amount: 10,
            timestamp: Date.now() - 2 * 60 * 60 * 1000
        },
        {
            type: 'tournament_entry',
            amount: 20,
            timestamp: Date.now() - 3 * 60 * 60 * 1000
        },
        {
            type: 'ad_view',
            amount: 5,
            timestamp: Date.now() - 24 * 60 * 60 * 1000
        }
    ];
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
