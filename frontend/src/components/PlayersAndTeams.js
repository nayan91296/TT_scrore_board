import React, { useState, useEffect } from 'react';
import { 
  getPlayers, createPlayer, updatePlayer, deletePlayer,
  getTeams, getTournaments, createTeam, deleteTeam 
} from '../services/api';
import PinVerification from './PinVerification';

const PlayersAndTeams = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Players state
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [playerSortBy, setPlayerSortBy] = useState('performance');
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerFormData, setPlayerFormData] = useState({
    name: ''
  });

  // Teams state
  const [teams, setTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    tournament: '',
    players: []
  });
  const [randomTeamForm, setRandomTeamForm] = useState({
    tournament: '',
    numberOfTeams: 2,
    playersPerTeam: 2
  });
  const [selectedPlayersForRandom, setSelectedPlayersForRandom] = useState([]);
  
  // Collapsed tournaments state
  const [collapsedTournaments, setCollapsedTournaments] = useState(new Set());
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const [maxVisibleTournaments] = useState(5); // Show only 5 most recent by default
  
  // PIN verification state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('');

  useEffect(() => {
    loadPlayers();
    loadTeams();
    loadTournaments();
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refresh player data when component becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Component is visible again, refresh player data
        loadPlayers();
      }
    };

    // Refresh player data when window gains focus
    const handleFocus = () => {
      loadPlayers();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    // Filter teams when tournament selection changes
    if (selectedTournament) {
      const filtered = allTeams.filter(team => 
        team.tournament?._id === selectedTournament || 
        team.tournament === selectedTournament ||
        team.tournament?._id?.toString() === selectedTournament
      );
      setTeams(filtered);
    } else {
      setTeams(allTeams);
    }
  }, [selectedTournament, allTeams]);

  // Players functions
  const loadPlayers = async () => {
    try {
      const response = await getPlayers();
      // Log to verify data structure
      console.log('Loaded players with stats:', response.data);
      if (response.data && response.data.length > 0) {
        console.log('Sample player:', {
          name: response.data[0].name,
          matchesWon: response.data[0].matchesWon,
          matchesLost: response.data[0].matchesLost,
          _id: response.data[0]._id
        });
      }
      setAllPlayers(response.data || []);
      applyPlayerFiltersAndSort(response.data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      alert('Failed to load players');
    }
  };

  const applyPlayerFiltersAndSort = (playersList = allPlayers) => {
    // Filter by search term
    let filtered = playersList;
    if (playerSearchTerm.trim()) {
      const term = playerSearchTerm.toLowerCase();
      filtered = playersList.filter(player => 
        player.name.toLowerCase().includes(term) ||
        (player.email && player.email.toLowerCase().includes(term)) ||
        (player.phone && player.phone.includes(term))
      );
    }

    // Sort players
    const sorted = [...filtered].sort((a, b) => {
      switch (playerSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'totalMatches':
          return (b.totalMatches || 0) - (a.totalMatches || 0);
        case 'tournamentsWon':
          return (b.tournamentsWon || 0) - (a.tournamentsWon || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'performance':
          // Calculate performance score based on multiple factors
          const calculatePerformanceScore = (player) => {
            const matchesWon = player.matchesWon || 0;
            const matchesLost = player.matchesLost || 0;
            const totalMatches = matchesWon + matchesLost;
            const winPercentage = player.winPercentage !== undefined && player.winPercentage !== null 
              ? player.winPercentage 
              : (totalMatches > 0 ? (matchesWon / totalMatches) * 100 : 0);
            const tournamentsWon = player.tournamentsWon || 0;
            const semiFinals = player.semiFinalMatches || 0;
            const finals = player.finalMatches || 0;
            
            // Performance score calculation:
            // - Win percentage (0-100) weighted by 50%
            // - Total matches (normalized, max 50 points) weighted by 20%
            // - Tournaments won (10 points each) weighted by 20%
            // - Finals reached (5 points each) weighted by 5%
            // - Semi-finals reached (2 points each) weighted by 5%
            
            const winPctScore = winPercentage * 0.5;
            const matchesScore = Math.min(totalMatches * 0.5, 50) * 0.2; // Max 50 matches = 50 points
            const tournamentsScore = tournamentsWon * 10 * 0.2;
            const finalsScore = finals * 5 * 0.05;
            const semiFinalsScore = semiFinals * 2 * 0.05;
            
            return winPctScore + matchesScore + tournamentsScore + finalsScore + semiFinalsScore;
          };
          
          const aScore = calculatePerformanceScore(a);
          const bScore = calculatePerformanceScore(b);
          return bScore - aScore; // Higher score = better performance
        case 'winPercentage':
        default:
          const aMatchesWon = a.matchesWon || 0;
          const aMatchesLost = a.matchesLost || 0;
          const aTotalMatches = aMatchesWon + aMatchesLost;
          const aWinPercentage = a.winPercentage !== undefined && a.winPercentage !== null 
            ? a.winPercentage 
            : (aTotalMatches > 0 ? (aMatchesWon / aTotalMatches) * 100 : 0);
          
          const bMatchesWon = b.matchesWon || 0;
          const bMatchesLost = b.matchesLost || 0;
          const bTotalMatches = bMatchesWon + bMatchesLost;
          const bWinPercentage = b.winPercentage !== undefined && b.winPercentage !== null 
            ? b.winPercentage 
            : (bTotalMatches > 0 ? (bMatchesWon / bTotalMatches) * 100 : 0);
          
          return bWinPercentage - aWinPercentage;
      }
    });
    
    setPlayers(sorted);
  };

  useEffect(() => {
    if (allPlayers.length > 0) {
      applyPlayerFiltersAndSort(allPlayers);
    }
  }, [playerSearchTerm, playerSortBy, allPlayers]);

  const handlePlayerSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlayer) {
        await updatePlayer(editingPlayer._id, playerFormData);
      } else {
        await createPlayer(playerFormData);
      }
      setShowPlayerModal(false);
      setEditingPlayer(null);
      setPlayerFormData({ name: '' });
      loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Failed to save player');
    }
  };

  const handlePlayerEdit = (player) => {
    setPendingAction(() => () => {
      setEditingPlayer(player);
      setPlayerFormData({
        name: player.name
      });
      setShowPlayerModal(true);
    });
    setPendingActionType('edit-player');
    setShowPinModal(true);
  };

  const handlePlayerDelete = (id) => {
    setPendingAction(() => async () => {
      try {
        await deletePlayer(id);
        loadPlayers();
      } catch (error) {
        console.error('Error deleting player:', error);
        alert('Failed to delete player');
      }
    });
    setPendingActionType('delete-player');
    setShowPinModal(true);
  };

  const handlePinVerify = () => {
    setShowPinModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
      setPendingActionType('');
    }
  };

  const handlePinCancel = () => {
    setShowPinModal(false);
    setPendingAction(null);
    setPendingActionType('');
  };

  const closePlayerModal = () => {
    setShowPlayerModal(false);
    setEditingPlayer(null);
    setPlayerFormData({ name: '' });
  };

  // Teams functions
  const loadTeams = async () => {
    try {
      const response = await getTeams();
      setAllTeams(response.data);
      setTeams(response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
      alert('Failed to load teams');
    }
  };

  const loadTournaments = async () => {
    try {
      const response = await getTournaments();
      setTournaments(response.data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!teamFormData.tournament || teamFormData.players.length === 0) {
      alert('Please select a tournament and at least one player');
      return;
    }
    try {
      await createTeam(teamFormData);
      setShowTeamModal(false);
      setTeamFormData({ name: '', tournament: '', players: [] });
      loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      alert(error.response?.data?.error || 'Failed to create team');
    }
  };

  const handlePlayerToggle = (playerId) => {
    if (teamFormData.players.includes(playerId)) {
      setTeamFormData({ ...teamFormData, players: teamFormData.players.filter(id => id !== playerId) });
    } else {
      setTeamFormData({ ...teamFormData, players: [...teamFormData.players, playerId] });
    }
  };

  const handleTeamDelete = (id, tournamentStatus) => {
    // Prevent deleting teams from completed tournaments
    if (tournamentStatus === 'completed') {
      alert('Cannot delete teams from completed tournaments');
      return;
    }
    
    setPendingAction(() => async () => {
      if (!window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
        return;
      }
      
      try {
        await deleteTeam(id);
        loadTeams();
        alert('Team deleted successfully');
      } catch (error) {
        console.error('Error deleting team:', error);
        alert('Failed to delete team: ' + (error.response?.data?.error || error.message));
      }
    });
    setPendingActionType('delete-team');
    setShowPinModal(true);
  };

  const handleDeleteAllTeams = (tournamentId, teams, tournamentStatus) => {
    // Prevent deleting teams from completed tournaments
    if (tournamentStatus === 'completed') {
      alert('Cannot delete teams from completed tournaments');
      return;
    }
    
    if (teams.length === 0) {
      alert('No teams to delete for this tournament');
      return;
    }
    
    setPendingAction(() => async () => {
      if (!window.confirm(`Are you sure you want to delete all ${teams.length} team(s) from this tournament? This action cannot be undone.`)) {
        return;
      }
      
      try {
        // Delete all teams for this tournament
        const deletePromises = teams.map(team => deleteTeam(team._id));
        await Promise.all(deletePromises);
        loadTeams();
        alert(`Successfully deleted ${teams.length} team(s) from the tournament`);
      } catch (error) {
        console.error('Error deleting teams:', error);
        alert('Failed to delete teams: ' + (error.response?.data?.error || error.message));
      }
    });
    setPendingActionType('delete-all-teams');
    setShowPinModal(true);
  };

  const handleGenerateRandomTeams = async (e) => {
    e.preventDefault();
    if (!randomTeamForm.tournament) {
      alert('Please select a tournament');
      return;
    }

    if (selectedPlayersForRandom.length === 0) {
      alert('Please select at least one player');
      return;
    }

    const existingTeams = allTeams.filter(team => 
      team.tournament?._id === randomTeamForm.tournament || 
      team.tournament === randomTeamForm.tournament ||
      team.tournament?._id?.toString() === randomTeamForm.tournament
    );
    
    if (existingTeams.length > 0) {
      const confirmMessage = `This tournament already has ${existingTeams.length} team(s). Do you want to create additional teams?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    // Get selected players from the players array
    const availablePlayers = players.filter(p => selectedPlayersForRandom.includes(p._id));
    
    if (availablePlayers.length === 0) {
      alert('No players selected. Please select players first.');
      return;
    }

    const totalPlayersNeeded = randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam;
    if (availablePlayers.length < totalPlayersNeeded) {
      alert(`Not enough selected players! You need ${totalPlayersNeeded} players but only have ${availablePlayers.length} selected. Please reduce number of teams or players per team, or select more players.`);
      return;
    }

    try {
      const shuffledPlayers = [...availablePlayers].sort(() => Math.random() - 0.5);
      
      const teamsToCreate = [];
      for (let i = 0; i < randomTeamForm.numberOfTeams; i++) {
        const teamPlayers = shuffledPlayers.slice(
          i * randomTeamForm.playersPerTeam,
          (i + 1) * randomTeamForm.playersPerTeam
        );
        
        teamsToCreate.push({
          name: `Team ${i + 1}`,
          tournament: randomTeamForm.tournament,
          players: teamPlayers.map(p => p._id)
        });
      }

      for (const teamData of teamsToCreate) {
        await createTeam(teamData);
      }

      setShowRandomModal(false);
      setRandomTeamForm({ tournament: '', numberOfTeams: 2, playersPerTeam: 2 });
      setSelectedPlayersForRandom([]);
      loadTeams();
      alert(`Successfully created ${randomTeamForm.numberOfTeams} team(s) for the tournament!`);
    } catch (error) {
      console.error('Error generating random teams:', error);
      alert(error.response?.data?.error || 'Failed to generate random teams');
    }
  };

  const handlePlayerToggleForRandom = (playerId) => {
    if (selectedPlayersForRandom.includes(playerId)) {
      setSelectedPlayersForRandom(selectedPlayersForRandom.filter(id => id !== playerId));
    } else {
      setSelectedPlayersForRandom([...selectedPlayersForRandom, playerId]);
    }
  };

  const handleSelectAllPlayers = () => {
    if (selectedPlayersForRandom.length === players.length) {
      setSelectedPlayersForRandom([]);
    } else {
      setSelectedPlayersForRandom(players.map(p => p._id));
    }
  };

  // Group teams by tournament
  const teamsByTournament = {};
  teams.forEach(team => {
    const tournamentId = team.tournament?._id || team.tournament || 'no-tournament';
    const tournamentName = team.tournament?.name || 'No Tournament';
    if (!teamsByTournament[tournamentId]) {
      teamsByTournament[tournamentId] = {
        name: tournamentName,
        teams: [],
        tournament: team.tournament
      };
    }
    teamsByTournament[tournamentId].teams.push(team);
  });

  // Sort tournaments by date (newest first)
  const sortedTournamentEntries = Object.entries(teamsByTournament).sort((a, b) => {
    const dateA = a[1].tournament?.startDate ? new Date(a[1].tournament.startDate) : new Date(0);
    const dateB = b[1].tournament?.startDate ? new Date(b[1].tournament.startDate) : new Date(0);
    return dateB - dateA; // Newest first
  });

  // Group tournaments by month/week for better organization
  const groupTournamentsByPeriod = (entries) => {
    const groups = {};
    entries.forEach(([tournamentId, tournamentData]) => {
      if (!tournamentData.tournament?.startDate) {
        if (!groups['Other']) groups['Other'] = [];
        groups['Other'].push([tournamentId, tournamentData]);
        return;
      }
      
      const date = new Date(tournamentData.tournament.startDate);
      const today = new Date();
      const diffTime = today - date;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let period;
      if (diffDays < 0) {
        period = 'Upcoming';
      } else if (diffDays === 0) {
        period = 'Today';
      } else if (diffDays === 1) {
        period = 'Yesterday';
      } else if (diffDays <= 7) {
        period = 'This Week';
      } else if (diffDays <= 30) {
        period = 'This Month';
      } else {
        const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        period = monthYear;
      }
      
      if (!groups[period]) groups[period] = [];
      groups[period].push([tournamentId, tournamentData]);
    });
    
    // Sort periods: Today, Yesterday, This Week, This Month, then months chronologically, then Other
    const periodOrder = ['Upcoming', 'Today', 'Yesterday', 'This Week', 'This Month'];
    const sortedGroups = {};
    
    periodOrder.forEach(period => {
      if (groups[period]) {
        sortedGroups[period] = groups[period];
      }
    });
    
    Object.keys(groups)
      .filter(p => !periodOrder.includes(p))
      .sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return new Date(b) - new Date(a);
      })
      .forEach(period => {
        sortedGroups[period] = groups[period];
      });
    
    return sortedGroups;
  };

  const tournamentGroups = groupTournamentsByPeriod(sortedTournamentEntries);
  
  // Limit visible tournaments if not showing all
  const visibleTournamentEntries = showAllTournaments 
    ? sortedTournamentEntries 
    : sortedTournamentEntries.slice(0, maxVisibleTournaments);
  
  // Auto-collapse all tournaments on load
  useEffect(() => {
    const allCollapsed = new Set();
    sortedTournamentEntries.forEach(([tournamentId]) => {
      allCollapsed.add(tournamentId);
    });
    setCollapsedTournaments(allCollapsed);
  }, [sortedTournamentEntries.length]);

  const toggleTournament = (tournamentId) => {
    setCollapsedTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  // Render tournament card component
  const renderTournamentCard = (tournamentId, tournamentData, index) => {
    const colorScheme = tournamentColors[index % tournamentColors.length];
    const isCollapsed = collapsedTournaments.has(tournamentId);
    const tournamentDate = tournamentData.tournament?.startDate 
      ? new Date(tournamentData.tournament.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    
    return (
      <div key={tournamentId} className="card" style={{ 
        marginBottom: '12px',
        border: `1px solid ${colorScheme.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Compact Tournament Header */}
        <div 
          style={{
            background: `linear-gradient(135deg, ${colorScheme.header} 0%, ${colorScheme.border} 100%)`,
            color: 'white',
            padding: '10px 15px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            transition: 'background 0.2s'
          }}
          onClick={() => toggleTournament(tournamentId)}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>
                  {tournamentData.name}
                </h3>
                {tournamentDate && (
                  <span style={{ fontSize: '11px', opacity: 0.85 }}>
                    ({tournamentDate})
                  </span>
                )}
                {tournamentData.tournament?.status && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.25)',
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {tournamentData.tournament.status}
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                {tournamentData.teams.length} team(s)
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {tournamentData.tournament && tournamentData.tournament.status !== 'completed' && tournamentData.teams.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAllTeams(tournamentId, tournamentData.teams, tournamentData.tournament.status);
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(220, 53, 69, 0.9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(220, 53, 69, 1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'}
                title={`Delete all ${tournamentData.teams.length} team(s) from this tournament`}
              >
                🗑️ Delete All
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Teams Table */}
        {!isCollapsed && (
          <div style={{ background: '#fff', padding: '12px' }}>
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, background: 'white', minWidth: windowWidth < 768 ? '600px' : '100%', fontSize: windowWidth < 480 ? '12px' : '13px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ color: '#000', fontWeight: 'bold', padding: '8px', fontSize: '12px' }}>Team</th>
                    <th style={{ color: '#000', fontWeight: 'bold', padding: '8px', fontSize: '12px' }}>Players</th>
                    <th style={{ color: '#000', fontWeight: 'bold', textAlign: 'center', padding: '8px', fontSize: '12px' }}>W</th>
                    <th style={{ color: '#000', fontWeight: 'bold', textAlign: 'center', padding: '8px', fontSize: '12px' }}>Pts</th>
                    <th style={{ color: '#000', fontWeight: 'bold', padding: '8px', fontSize: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentData.teams.map((team, teamIndex) => (
                    <tr 
                      key={team._id}
                      style={{
                        backgroundColor: teamIndex % 2 === 0 ? 'white' : '#f8f9fa',
                        borderLeft: `3px solid ${colorScheme.border}`
                      }}
                    >
                      <td style={{ padding: '8px' }}>
                        <strong style={{ color: colorScheme.header, fontSize: '13px' }}>{team.name}</strong>
                      </td>
                      <td style={{ padding: '8px' }}>
                        {team.players?.map((p, idx) => (
                          <span key={p._id} style={{ fontSize: '12px' }}>
                            {p.name}
                            {idx < team.players.length - 1 ? ', ' : ''}
                          </span>
                        )) || '-'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4caf50', padding: '8px', fontSize: '13px' }}>
                        {team.matchesWon || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: colorScheme.header, padding: '8px', fontSize: '14px' }}>
                        {team.points || 0}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {tournamentData.tournament && tournamentData.tournament.status !== 'completed' && (
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleTeamDelete(team._id, tournamentData.tournament.status)} 
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            Delete
                          </button>
                        )}
                        {tournamentData.tournament && tournamentData.tournament.status === 'completed' && (
                          <span style={{ color: '#999', fontSize: '11px', fontStyle: 'italic' }}>
                            Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tournamentColors = [
    { bg: '#e3f2fd', border: '#2196f3', header: '#1976d2' },
    { bg: '#f3e5f5', border: '#9c27b0', header: '#7b1fa2' },
    { bg: '#e8f5e9', border: '#4caf50', header: '#388e3c' },
    { bg: '#fff3e0', border: '#ff9800', header: '#f57c00' },
    { bg: '#fce4ec', border: '#e91e63', header: '#c2185b' },
    { bg: '#e0f2f1', border: '#009688', header: '#00796b' },
    { bg: '#f1f8e9', border: '#8bc34a', header: '#689f38' },
    { bg: '#ede7f6', border: '#673ab7', header: '#512da8' }
  ];

  return (
    <div>
      {/* Two Column Layout: Players (Left) and Teams (Right) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr', 
        gap: windowWidth < 768 ? '15px' : '20px',
        alignItems: 'start'
      }}>
        {/* Left Column: Players */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h2 style={{ margin: 0, fontSize: windowWidth < 768 ? '22px' : windowWidth < 480 ? '20px' : '28px' }}>Players</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={(e) => {
                  loadPlayers();
                  // Show a brief feedback
                  const btn = e.target;
                  const originalText = btn.textContent;
                  btn.textContent = '✓ Refreshed';
                  btn.disabled = true;
                  setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                  }, 1500);
                }} 
                style={{ padding: windowWidth < 480 ? '6px 12px' : '8px 16px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}
              >
                🔄 Refresh
              </button>
              <button className="btn btn-primary" onClick={() => setShowPlayerModal(true)} style={{ padding: windowWidth < 480 ? '6px 12px' : '8px 16px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}>
                + Add Player
              </button>
            </div>
          </div>

          {/* Search and Sort Controls */}
          {allPlayers.length > 0 && (
            <div className="card" style={{ marginBottom: '15px', padding: windowWidth < 480 ? '12px' : '15px' }}>
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: windowWidth < 480 ? '12px' : '14px' }}>
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: windowWidth < 480 ? '6px 10px' : '8px 12px',
                      borderRadius: '5px',
                      border: '1px solid #ddd',
                      fontSize: windowWidth < 480 ? '12px' : '14px'
                    }}
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: windowWidth < 480 ? '12px' : '14px' }}>
                    📊 Sort
                  </label>
                  <select
                    value={playerSortBy}
                    onChange={(e) => setPlayerSortBy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: windowWidth < 480 ? '6px 10px' : '8px 12px',
                      borderRadius: '5px',
                      border: '1px solid #ddd',
                      fontSize: windowWidth < 480 ? '12px' : '14px'
                    }}
                  >
                    <option value="performance">⭐ Greatest Performance</option>
                    <option value="winPercentage">Win %</option>
                    <option value="name">Name</option>
                    <option value="totalMatches">Matches</option>
                    <option value="tournamentsWon">Trophies</option>
                    {/* <option value="rating">Rating</option> */}
                  </select>
                </div>
              </div>
              {playerSearchTerm && (
                <div style={{ marginTop: '8px', fontSize: windowWidth < 480 ? '11px' : '13px', color: '#666' }}>
                  Showing {players.length} of {allPlayers.length} players
                </div>
              )}
            </div>
          )}

          {allPlayers.length === 0 ? (
            <div className="card">
              <p>No players yet. Add your first player!</p>
            </div>
          ) : players.length === 0 ? (
            <div className="card">
              <p>No players found matching your search.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: windowWidth < 480 ? '15px' : '20px' }}>
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="table" style={{ minWidth: windowWidth < 768 ? '900px' : '100%', fontSize: windowWidth < 480 ? '11px' : '14px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>Rank</th>
                      <th>Name</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Won</th>
                      <th style={{ textAlign: 'center' }}>Lost</th>
                      <th style={{ textAlign: 'center' }}>Win %</th>
                    
                      <th style={{ textAlign: 'center' }}>Semi</th>
                      <th style={{ textAlign: 'center' }}>Final</th>
                      <th style={{ textAlign: 'center' }}>🏆</th>
                      <th style={{ textAlign: 'center' }}>Tournaments</th>
                      {/* <th style={{ fontSize: windowWidth < 480 ? '10px' : '12px' }}>Joined</th> */}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      // Ensure we use the dynamically calculated stats
                      const matchesWon = player.matchesWon !== undefined && player.matchesWon !== null ? player.matchesWon : 0;
                      const matchesLost = player.matchesLost !== undefined && player.matchesLost !== null ? player.matchesLost : 0;
                      const totalMatches = matchesWon + matchesLost;
                      const winPercentage = player.winPercentage !== undefined && player.winPercentage !== null 
                        ? player.winPercentage 
                        : (totalMatches > 0 ? parseFloat(((matchesWon / totalMatches) * 100).toFixed(1)) : 0);
                      const tournamentsWon = player.tournamentsWon !== undefined && player.tournamentsWon !== null ? player.tournamentsWon : 0;
                      const rank = index + 1;
                      
                      // Determine if player is in top 3 based on current sort
                      let isTopThree = false;
                      if (rank <= 3) {
                        if (playerSortBy === 'performance') {
                          // Always highlight top 3 for performance (calculated score)
                          isTopThree = true;
                        } else if (playerSortBy === 'winPercentage') {
                          // Highlight top 3 for win % if they have matches
                          isTopThree = totalMatches > 0;
                        } else if (playerSortBy === 'tournamentsWon') {
                          // Highlight top 3 for trophies if they have tournaments won
                          isTopThree = tournamentsWon > 0;
                        }
                      }
                      
                      const joinedDate = player.createdAt 
                        ? new Date(player.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '-';
                      
                      return (
                      <tr 
                        key={player._id}
                        style={{
                          backgroundColor: isTopThree ? '#e8f5e9' : 'transparent',
                          borderLeft: isTopThree ? '4px solid #4caf50' : 'none'
                        }}
                      >
                        <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: windowWidth < 480 ? '14px' : '16px' }}>
                          {rank === 1 && isTopThree && '🥇'}
                          {rank === 2 && isTopThree && '🥈'}
                          {rank === 3 && isTopThree && '🥉'}
                          {!isTopThree && rank}
                        </td>
                        <td>
                          <strong>{player.name}</strong>
                          {isTopThree && <span style={{ marginLeft: '5px', color: '#4caf50' }}>⭐</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{player.totalMatches || 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>{matchesWon}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#f44336' }}>{matchesLost}</td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          color: winPercentage >= 70 ? '#4caf50' : winPercentage >= 50 ? '#8bc34a' : winPercentage > 0 ? '#ff9800' : '#666',
                          fontSize: windowWidth < 480 ? '12px' : '14px'
                        }}>
                          {winPercentage}%
                        </td>
                      
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2196f3' }}>{player.semiFinalMatches || 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ff9800' }}>{player.finalMatches || 0}</td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          color: tournamentsWon > 0 ? '#ff9800' : '#666',
                          fontSize: windowWidth < 480 ? '14px' : '16px'
                        }}>
                          {tournamentsWon}
                        </td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          color: '#673ab7',
                          fontSize: windowWidth < 480 ? '13px' : '14px'
                        }}>
                          {player.tournamentsPlayed || 0}
                        </td>
                        {/* <td style={{ fontSize: windowWidth < 480 ? '10px' : '12px', color: '#666' }}>{joinedDate}</td> */}
                        <td>
                          <button className="btn btn-primary" onClick={() => handlePlayerEdit(player)} style={{ marginRight: '5px', padding: '5px 10px', fontSize: windowWidth < 480 ? '11px' : '14px' }}>
                            Edit
                          </button>
                          <button className="btn btn-danger" onClick={() => handlePlayerDelete(player._id)} style={{ padding: '5px 10px', fontSize: windowWidth < 480 ? '11px' : '14px' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Player Modal */}
          {showPlayerModal && (
            <div className="modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>{editingPlayer ? 'Edit Player' : 'Add Player'}</h2>
                  <span className="close" onClick={closePlayerModal}>&times;</span>
                </div>
                <form onSubmit={handlePlayerSubmit}>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      required
                      value={playerFormData.name}
                      onChange={(e) => setPlayerFormData({ ...playerFormData, name: e.target.value })}
                      placeholder="Enter player name"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={closePlayerModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingPlayer ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Teams */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h2 style={{ margin: 0, fontSize: windowWidth < 768 ? '22px' : windowWidth < 480 ? '20px' : '28px' }}>Teams</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowRandomModal(true)} style={{ padding: windowWidth < 480 ? '6px 12px' : '8px 16px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}>
                🎲 Random
              </button>
              <button className="btn btn-primary" onClick={() => setShowTeamModal(true)} style={{ padding: windowWidth < 480 ? '6px 12px' : '8px 16px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}>
                + Create Team
              </button>
            </div>
          </div>

          {/* Tournament Filter and Controls */}
          <div className="card" style={{ marginBottom: '15px', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Filter:</label>
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid #ddd', minWidth: '180px', fontSize: '13px' }}
                >
                  <option value="">All Tournaments</option>
                  {tournaments.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {selectedTournament && (
                  <span style={{ color: '#666', fontSize: '12px' }}>
                    {teams.length} team(s)
                  </span>
                )}
              </div>
              {!selectedTournament && sortedTournamentEntries.length > maxVisibleTournaments && (
                <button
                  onClick={() => setShowAllTournaments(!showAllTournaments)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: showAllTournaments ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {showAllTournaments ? `Show Less (${maxVisibleTournaments})` : `Show All (${sortedTournamentEntries.length})`}
                </button>
              )}
            </div>
          </div>

          {teams.length === 0 ? (
            <div className="card">
              <p>No teams yet. Create your first team!</p>
            </div>
          ) : (
            <div>
              {!selectedTournament && !showAllTournaments && Object.keys(tournamentGroups).length > 1 ? (
                // Show grouped view when not showing all
                Object.entries(tournamentGroups).map(([period, periodTournaments]) => {
                  if (periodTournaments.length === 0) return null;
                  const visibleInPeriod = periodTournaments.slice(0, period === 'Today' || period === 'Yesterday' || period === 'This Week' ? 10 : 3);
                  
                  return (
                    <div key={period} style={{ marginBottom: '15px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        color: '#666', 
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {period} ({periodTournaments.length})
                      </div>
                      {visibleInPeriod.map(([tournamentId, tournamentData], index) => {
                        const globalIndex = sortedTournamentEntries.findIndex(([id]) => id === tournamentId);
                        return renderTournamentCard(tournamentId, tournamentData, globalIndex);
                      })}
                      {periodTournaments.length > visibleInPeriod.length && (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '8px',
                          color: '#666',
                          fontSize: '12px',
                          fontStyle: 'italic'
                        }}>
                          + {periodTournaments.length - visibleInPeriod.length} more tournament(s) - 
                          <button
                            onClick={() => setShowAllTournaments(true)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#007bff',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: '0 4px',
                              fontSize: '12px'
                            }}
                          >
                            Show All
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Show flat list when showing all or filtered
                visibleTournamentEntries.map(([tournamentId, tournamentData], index) => {
                  return renderTournamentCard(tournamentId, tournamentData, index);
                })
              )}
            </div>
          )}

          {/* Create Team Modal */}
          {showTeamModal && (
            <div className="modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>Create Team</h2>
                  <span className="close" onClick={() => setShowTeamModal(false)}>&times;</span>
                </div>
                <form onSubmit={handleTeamSubmit}>
                  <div className="form-group">
                    <label>Team Name *</label>
                    <input
                      type="text"
                      required
                      value={teamFormData.name}
                      onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tournament *</label>
                    <select
                      required
                      value={teamFormData.tournament}
                      onChange={(e) => setTeamFormData({ ...teamFormData, tournament: e.target.value })}
                    >
                      <option value="">Select Tournament</option>
                      {tournaments.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label>Players * (Select at least one)</label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (teamFormData.players.length === players.length) {
                            setTeamFormData({ ...teamFormData, players: [] });
                          } else {
                            setTeamFormData({ ...teamFormData, players: players.map(p => p._id) });
                          }
                        }}
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                      >
                        {teamFormData.players.length === players.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      padding: '10px',
                      background: '#f9f9f9'
                    }}>
                      {players.length === 0 ? (
                        <p style={{ color: '#999' }}>No players available. Add players first.</p>
                      ) : (
                        players.map(player => (
                          <label
                            key={player._id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              padding: '10px 12px',
                              borderRadius: '4px',
                              background: teamFormData.players.includes(player._id) ? '#e3f2fd' : 'transparent',
                              transition: 'background 0.2s',
                              minHeight: '40px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={teamFormData.players.includes(player._id)}
                              onChange={() => handlePlayerToggle(player._id)}
                              style={{
                                marginRight: '12px',
                                width: '18px',
                                height: '18px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              userSelect: 'none'
                            }}>
                              {player.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    {teamFormData.players.length > 0 && (
                      <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                        Selected: <strong>{teamFormData.players.length}</strong> player(s) out of {players.length} total
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTeamModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Generate Random Teams Modal */}
          {showRandomModal && (
            <div className="modal">
              <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                  <h2>Generate Random Teams</h2>
                  <span className="close" onClick={() => {
                    setShowRandomModal(false);
                    setSelectedPlayersForRandom([]);
                  }}>&times;</span>
                </div>
                <form onSubmit={handleGenerateRandomTeams}>
                  <div className="form-group">
                    <label>Tournament *</label>
                    <select
                      required
                      value={randomTeamForm.tournament}
                      onChange={(e) => setRandomTeamForm({ ...randomTeamForm, tournament: e.target.value })}
                    >
                      <option value="">Select Tournament</option>
                      {tournaments.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Number of Teams</label>
                    <input
                      type="number"
                      min="2"
                      value={randomTeamForm.numberOfTeams}
                      onChange={(e) => setRandomTeamForm({ ...randomTeamForm, numberOfTeams: parseInt(e.target.value) || 2 })}
                      placeholder="Enter number of teams"
                    />
                    <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                      No maximum limit - create as many teams as you have players for
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Players per Team</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={randomTeamForm.playersPerTeam}
                      onChange={(e) => setRandomTeamForm({ ...randomTeamForm, playersPerTeam: parseInt(e.target.value) || 2 })}
                    />
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label>Select Players * (Select players to include in random teams)</label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSelectAllPlayers}
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                      >
                        {selectedPlayersForRandom.length === players.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div style={{ 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      border: '1px solid #ddd', 
                      borderRadius: '5px', 
                      padding: '10px',
                      background: '#f9f9f9'
                    }}>
                      {players.length === 0 ? (
                        <p style={{ color: '#999' }}>No players available. Add players first.</p>
                      ) : (
                        players.map(player => (
                          <label 
                            key={player._id} 
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '8px', 
                              cursor: 'pointer',
                              padding: '10px 12px',
                              borderRadius: '4px',
                              background: selectedPlayersForRandom.includes(player._id) ? '#e3f2fd' : 'transparent',
                              transition: 'background 0.2s',
                              minHeight: '40px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlayersForRandom.includes(player._id)}
                              onChange={() => handlePlayerToggleForRandom(player._id)}
                              style={{ 
                                marginRight: '12px',
                                width: '18px',
                                height: '18px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                            <span style={{ 
                              fontSize: '14px',
                              fontWeight: '500',
                              userSelect: 'none'
                            }}>
                              {player.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedPlayersForRandom.length > 0 && (
                      <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                        Selected: <strong>{selectedPlayersForRandom.length}</strong> player(s) out of {players.length} total
                      </p>
                    )}
                  </div>
                  <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '5px', marginBottom: '15px' }}>
                    <strong>Selected Players:</strong> {selectedPlayersForRandom.length}
                    <br />
                    <strong>Existing Teams in Tournament:</strong> {
                      randomTeamForm.tournament 
                        ? allTeams.filter(team => 
                            team.tournament?._id === randomTeamForm.tournament || 
                            team.tournament === randomTeamForm.tournament ||
                            team.tournament?._id?.toString() === randomTeamForm.tournament
                          ).length
                        : 0
                    }
                    <br />
                    <strong>Total Players Needed:</strong> {randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam}
                    {selectedPlayersForRandom.length < randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam && (
                      <div style={{ color: '#d32f2f', marginTop: '5px', fontWeight: 'bold' }}>
                        ⚠️ Not enough selected players! Need {randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam} but only {selectedPlayersForRandom.length} selected.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowRandomModal(false);
                        setSelectedPlayersForRandom([]);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Generate Teams
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showPinModal && (
            <PinVerification
              onVerify={handlePinVerify}
              onCancel={handlePinCancel}
              action={
                pendingActionType === 'delete-player' ? 'delete this player' :
                pendingActionType === 'edit-player' ? 'edit this player' :
                pendingActionType === 'delete-team' ? 'delete this team' :
                pendingActionType === 'delete-all-teams' ? 'delete all teams' :
                'perform this action'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayersAndTeams;

