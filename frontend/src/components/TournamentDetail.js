import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTournament,
  getTeamsByTournament,
  getMatchesByTournament,
  generateSemiFinals,
  generateFinal,
  generateGroupMatches,
  createMatch,
  addScore,
  updateMatch,
  updateTournament,
  recalculateTeamStats,
  deleteMatch,
  performToss
} from '../services/api';
import PinVerification from './PinVerification';

const TournamentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(null);
  const [matchForm, setMatchForm] = useState({
    team1: '',
    team2: '',
    matchType: 'group'
  });
  const [scoreForm, setScoreForm] = useState({
    setNumber: 10,
    team1Score: 0,
    team2Score: 0
  });
  
  // PIN verification state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState({
    createMatch: false,
    deleteMatch: null,
    generateGroupMatches: false,
    generateSemiFinals: false,
    updateSemiFinal2: false,
    generateFinal: false,
    toss: null,
    addScore: false,
    markComplete: null,
    recalculateStats: false,
    updateStatus: false
  });
  
  // Winner celebration state
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState(null);
  
  // Toss state
  const [showTossModal, setShowTossModal] = useState(null);
  const [tossAnimating, setTossAnimating] = useState(false);
  const [tossResult, setTossResult] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if final match was just completed and show animation
  useEffect(() => {
    const finalMatch = matches.find(m => m.matchType === 'final');
    if (finalMatch && finalMatch.status === 'completed' && finalMatch.winner) {
      // Check if this is a newly completed final match
      const winnerId = finalMatch.winner._id || finalMatch.winner;
      const winnerTeamData = teams.find(t => {
        const teamId = t._id ? t._id.toString() : t.toString();
        return teamId === winnerId.toString();
      });
      
      if (winnerTeamData && (!winnerTeam || winnerTeam._id !== winnerTeamData._id)) {
        setWinnerTeam(winnerTeamData);
        setShowWinnerAnimation(true);
        // Auto-hide after 8 seconds
        setTimeout(() => {
          setShowWinnerAnimation(false);
        }, 8000);
      }
    }
  }, [matches, teams, winnerTeam]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [tournamentRes, teamsRes, matchesRes] = await Promise.all([
        getTournament(id),
        getTeamsByTournament(id),
        getMatchesByTournament(id)
      ]);
      setTournament(tournamentRes.data);
      setTeams(teamsRes.data);
      console.log('Loaded tournament:', {
        id: tournamentRes.data._id,
        name: tournamentRes.data.name,
        status: tournamentRes.data.status,
        winner: tournamentRes.data.winner,
        winnerType: typeof tournamentRes.data.winner,
        winnerName: tournamentRes.data.winner?.name,
        winnerId: tournamentRes.data.winner?._id || tournamentRes.data.winner,
        winnerPlayers: tournamentRes.data.winner?.players
      });
      console.log('Loaded teams:', teamsRes.data.map(t => ({
        name: t.name,
        id: t._id,
        hasPlayers: !!t.players,
        playersCount: t.players?.length || 0,
        players: t.players
      })));
      console.log('Loaded teams with stats:', teamsRes.data.map(t => ({ 
        name: t.name, 
        points: t.points, 
        won: t.matchesWon, 
        lost: t.matchesLost,
        played: t.matchesPlayed 
      })));
      // Ensure scores are properly set for each match
      const matchesWithScores = matchesRes.data.map(match => ({
        ...match,
        scores: match.scores || []
      }));
      console.log('Loaded matches with scores:', matchesWithScores.map(m => ({ id: m._id, scores: m.scores, status: m.status, winner: m.winner?.name })));
      setMatches(matchesWithScores);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load tournament data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setLoading({ ...loading, createMatch: true });
    try {
      await createMatch({
        tournament: id,
        ...matchForm
      });
      setShowMatchModal(false);
      setMatchForm({ team1: '', team2: '', matchType: 'group' });
      loadData();
    } catch (error) {
      console.error('Error creating match:', error);
      alert('Failed to create match');
    } finally {
      setLoading({ ...loading, createMatch: false });
    }
  };

  const handleGenerateSemiFinals = async () => {
    if (teams.length < 3) {
      alert('Need at least 3 teams for semi-finals');
      return;
    }
    setLoading({ ...loading, generateSemiFinals: true });
    // Filter matches to only completed GROUP matches with scores (points table only uses group matches)
    const completedMatchesWithScores = matches.filter(m => 
      m.status === 'completed' && 
      m.matchType === 'group' &&  // Only group matches for points table
      m.scores && 
      Array.isArray(m.scores) && 
      m.scores.length > 0
    );
    
    // Use the same sorting logic as the backend (with NRR)
    const sortedTeams = sortTeamsWithTieBreaker(teams, completedMatchesWithScores);
    
    // Log sorted teams for debugging
    console.log('=== Frontend: Sorted teams for semi-finals ===');
    console.log(`Total teams: ${teams.length}, Completed matches with scores: ${completedMatchesWithScores.length}`);
    sortedTeams.forEach((team, index) => {
      const nrr = calculateNRR(team._id, completedMatchesWithScores);
      console.log(`${index + 1}. ${team.name} (ID: ${team._id}) - Points: ${team.points}, NRR: ${nrr.toFixed(2)}, Wins: ${team.matchesWon}, Losses: ${team.matchesLost}`);
    });
    console.log('========================================');
    
    // Get top 3 teams for semi-finals
    const top3 = sortedTeams.slice(0, 3);
    
    console.log('Top 3 teams selected:', top3.map((t, i) => `${i + 1}. ${t.name}`));
    
    if (top3.length < 3) {
      alert('Need at least 3 teams for semi-finals');
      return;
    }
    
    // Check for ties in top 3 positions
    const checkTies = () => {
      const ties = [];
      for (let i = 0; i < top3.length; i++) {
        const team = top3[i];
        const teamNRR = calculateNRR(team._id, completedMatchesWithScores);
        
        // Check if this team is tied with the next team
        if (i < top3.length - 1) {
          const nextTeam = top3[i + 1];
          const nextNRR = calculateNRR(nextTeam._id, completedMatchesWithScores);
          
          if (team.points === nextTeam.points && 
              Math.abs(teamNRR - nextNRR) < 0.001 &&
              team.matchesWon === nextTeam.matchesWon &&
              team.matchesLost === nextTeam.matchesLost) {
            // Check head-to-head
            const h2h = getHeadToHeadResult(team._id, nextTeam._id, completedMatchesWithScores);
            if (h2h === 0) {
              ties.push({
                position: i + 1,
                teams: [team.name, nextTeam.name],
                points: team.points,
                nrr: teamNRR.toFixed(2)
              });
            }
          }
        }
      }
      return ties;
    };
    
    const ties = checkTies();
    if (ties.length > 0) {
      let tieMessage = '⚠️ Warning: Some teams are tied after all tie-breakers:\n\n';
      ties.forEach(tie => {
        tieMessage += `Position ${tie.position}: ${tie.teams.join(' and ')} (Points: ${tie.points}, NRR: ${tie.nrr})\n`;
        tieMessage += `  → Ranked by alphabetical order for semi-final placement\n\n`;
      });
      tieMessage += 'Semi-finals will be generated based on current ranking.';
      const proceed = window.confirm(tieMessage + '\n\nDo you want to proceed?');
      if (!proceed) {
        return;
      }
    }
    
    console.log('Frontend teams for semi-finals:', {
      semi1: `${top3[0].name} vs ${top3[1].name}`,
      semi2: `${top3[2].name} vs (Semi 1 loser)`,
      top3Teams: top3.map(t => t.name)
    });
    
    try {
      const response = await generateSemiFinals(id);
      console.log('Semi-finals response:', response.data);
      console.log('Tournament from response:', response.data?.tournament);
      console.log('Semi-finals from response:', response.data?.semiFinals);
      
      // Immediately reload data to get fresh tournament and matches
      await loadData();
    } catch (error) {
      console.error('Error generating semi-finals:', error);
      alert(error.response?.data?.error || 'Failed to generate semi-finals');
    } finally {
      setLoading({ ...loading, generateSemiFinals: false });
    }
  };

  const handleUpdateSemiFinal2 = async () => {
    setLoading({ ...loading, updateSemiFinal2: true });
    try {
      const response = await fetch(`https://tt-scrore-board.onrender.com/api/tournaments/${id}/update-semifinal2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        loadData();
      } else {
        alert(data.error || 'Failed to update semi-final 2');
      }
    } catch (error) {
      console.error('Error updating semi-final 2:', error);
      alert('Failed to update semi-final 2');
    } finally {
      setLoading({ ...loading, updateSemiFinal2: false });
    }
  };

  const handleGenerateFinal = async () => {
    setLoading({ ...loading, generateFinal: true });
    try {
      const response = await generateFinal(id);
      loadData();
    } catch (error) {
      console.error('Error generating final:', error);
      alert(error.response?.data?.error || 'Failed to generate final');
    } finally {
      setLoading({ ...loading, generateFinal: false });
    }
  };

  const handleGenerateGroupMatches = async () => {
    if (teams.length < 2) {
      alert('Need at least 2 teams to generate group matches');
      return;
    }

    // Check if group matches already exist
    const existingGroupMatches = matches.filter(m => m.matchType === 'group');
    
    if (existingGroupMatches.length > 0) {
      const confirmMessage = `This tournament already has ${existingGroupMatches.length} group match(es). Do you want to replace them with new matches?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setLoading({ ...loading, generateGroupMatches: true });
    try {
      const replace = existingGroupMatches.length > 0;
      const response = await generateGroupMatches(id, replace);
      
      if (response.data) {
        const totalMatches = response.data.totalMatches || response.data.matches?.length || 0;
        alert(`Successfully generated ${totalMatches} group match(es)!`);
        await loadData();
      }
    } catch (error) {
      console.error('Error generating group matches:', error);
      const errorMessage = error.response?.data?.error || 'Failed to generate group matches';
      
      // If matches exist, offer to replace
      if (error.response?.data?.existingMatches) {
        const replace = window.confirm(
          `Tournament already has ${error.response.data.existingMatches} group match(es). Do you want to replace them?`
        );
        if (replace) {
          try {
            const response = await generateGroupMatches(id, true);
            const totalMatches = response.data.totalMatches || response.data.matches?.length || 0;
            alert(`Successfully generated ${totalMatches} group match(es)!`);
            await loadData();
          } catch (retryError) {
            alert('Failed to generate group matches: ' + (retryError.response?.data?.error || retryError.message));
          }
        }
      } else {
        alert('Failed to generate group matches: ' + errorMessage);
      }
    } finally {
      setLoading({ ...loading, generateGroupMatches: false });
    }
  };

  const handleMatchDelete = (matchId) => {
    setPendingAction(() => async () => {
      if (!window.confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
        return;
      }
      
      setLoading({ ...loading, deleteMatch: matchId });
      try {
        await deleteMatch(matchId);
        await loadData(); // Reload all data to refresh team stats
        alert('Match deleted successfully');
      } catch (error) {
        console.error('Error deleting match:', error);
        alert('Failed to delete match: ' + (error.response?.data?.error || error.message));
      } finally {
        setLoading({ ...loading, deleteMatch: null });
      }
    });
    setPendingActionType('delete-match');
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

  const handleToss = async (match) => {
    if (!match.team1 || !match.team2) {
      alert('Both teams must be assigned to perform toss');
      return;
    }
    
    setLoading({ ...loading, toss: match._id });
    setShowTossModal(match);
    setTossAnimating(true);
    setTossResult(null);
    
    // Animate for 2 seconds, then perform toss
    setTimeout(async () => {
      try {
        const response = await performToss(match._id);
        const tossWinner = response.data.tossWinner;
        
        setTossResult({
          winner: tossWinner,
          team1: match.team1,
          team2: match.team2
        });
        setTossAnimating(false);
        
        // Reload data to get updated match
        await loadData();
      } catch (error) {
        console.error('Error performing toss:', error);
        alert('Failed to perform toss: ' + (error.response?.data?.error || error.message));
        setTossAnimating(false);
        setShowTossModal(null);
      } finally {
        setLoading({ ...loading, toss: null });
      }
    }, 2000);
  };

  const handleAddScore = async (matchId) => {
    setLoading({ ...loading, addScore: true });
    try {
      const response = await addScore(matchId, scoreForm);
      setShowScoreModal(null);
      setScoreForm({ setNumber: 10, team1Score: 0, team2Score: 0 });
      
      // Log the response to debug
      console.log('Score added response:', response.data);
      
      // Update the specific match in the matches array immediately
      if (response.data) {
        setMatches(prevMatches => 
          prevMatches.map(m => {
            if (m._id === matchId || m._id === response.data._id) {
              // Ensure scores array exists
              const updatedMatch = {
                ...response.data,
                scores: response.data.scores || []
              };
              console.log('Updating match with scores:', updatedMatch.scores);
              return updatedMatch;
            }
            return m;
          })
        );
      }
      
      // Reload all data to ensure points table and everything is updated
      await loadData();
    } catch (error) {
      console.error('Error adding score:', error);
      alert('Failed to add score: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading({ ...loading, addScore: false });
    }
  };

  const openScoreModal = (match) => {
    // Set default set number to 10
    setScoreForm({
      setNumber: 10,
      team1Score: 0,
      team2Score: 0
    });
    setShowScoreModal(match);
  };

  const getMatchTypeClass = (type) => {
    if (type === 'final') return 'final';
    if (type === 'semifinal') return 'semifinal';
    return '';
  };

  const getMatchStatusBadge = (status) => {
    const badges = {
      scheduled: 'badge-secondary',
      'in-progress': 'badge-info',
      completed: 'badge-success'
    };
    return <span className={`badge ${badges[status]}`}>{status}</span>;
  };

  const calculateSetWins = (match) => {
    let team1Wins = 0;
    let team2Wins = 0;
    if (match && match.scores && Array.isArray(match.scores) && match.scores.length > 0) {
      match.scores.forEach(score => {
        const team1Score = parseInt(score.team1Score) || 0;
        const team2Score = parseInt(score.team2Score) || 0;
        if (team1Score > team2Score) {
          team1Wins++;
        } else if (team2Score > team1Score) {
          team2Wins++;
        }
      });
    }
    return { team1Wins, team2Wins };
  };

  // Calculate Net Run Rate (NRR) for a team
  // NRR = (Total Points Scored - Total Points Conceded) / Total Sets Played
  const calculateNRR = (teamId, matches) => {
    let totalPointsScored = 0;
    let totalPointsConceded = 0;
    let totalSetsPlayed = 0;

    matches.forEach(match => {
      if (match.status !== 'completed' || !match.scores || !Array.isArray(match.scores)) {
        return;
      }

      const isTeam1 = match.team1?._id?.toString() === teamId.toString();
      const isTeam2 = match.team2?._id?.toString() === teamId.toString();

      if (!isTeam1 && !isTeam2) {
        return;
      }

      match.scores.forEach(score => {
        const team1Score = parseInt(score.team1Score) || 0;
        const team2Score = parseInt(score.team2Score) || 0;

        if (isTeam1) {
          totalPointsScored += team1Score;
          totalPointsConceded += team2Score;
        } else if (isTeam2) {
          totalPointsScored += team2Score;
          totalPointsConceded += team1Score;
        }
        totalSetsPlayed++;
      });
    });

    if (totalSetsPlayed === 0) {
      return 0;
    }

    const nrr = (totalPointsScored - totalPointsConceded) / totalSetsPlayed;
    return nrr;
  };

  // Get tie-breaker reason for a team compared to another
  const getTieBreakerReason = (team, otherTeam, matches) => {
    // If points are different, no tie-breaker needed
    if ((team.points || 0) !== (otherTeam.points || 0)) {
      return null;
    }

    // 1. Check Net Run Rate (NRR)
    const teamNRR = calculateNRR(team._id, matches);
    const otherNRR = calculateNRR(otherTeam._id, matches);
    
    if (teamNRR !== otherNRR) {
      const nrrDiff = teamNRR - otherNRR;
      if (nrrDiff > 0) {
        return `Better NRR (+${nrrDiff.toFixed(2)})`;
      } else {
        return `Lower NRR (${nrrDiff.toFixed(2)})`;
      }
    }

    // 2. Check wins
    if ((team.matchesWon || 0) > (otherTeam.matchesWon || 0)) {
      return `More wins (${team.matchesWon} vs ${otherTeam.matchesWon})`;
    }
    if ((otherTeam.matchesWon || 0) > (team.matchesWon || 0)) {
      return `Fewer wins (${team.matchesWon} vs ${otherTeam.matchesWon})`;
    }

    // 3. Check win rate
    const teamWinRate = (team.matchesPlayed || 0) > 0 ? (team.matchesWon || 0) / (team.matchesPlayed || 1) : 0;
    const otherWinRate = (otherTeam.matchesPlayed || 0) > 0 ? (otherTeam.matchesWon || 0) / (otherTeam.matchesPlayed || 1) : 0;
    if (teamWinRate > otherWinRate) {
      return `Better win rate (${(teamWinRate * 100).toFixed(1)}% vs ${(otherWinRate * 100).toFixed(1)}%)`;
    }
    if (otherWinRate > teamWinRate) {
      return `Lower win rate (${(teamWinRate * 100).toFixed(1)}% vs ${(otherWinRate * 100).toFixed(1)}%)`;
    }

    // 4. Check losses
    if ((team.matchesLost || 0) < (otherTeam.matchesLost || 0)) {
      return `Fewer losses (${team.matchesLost} vs ${otherTeam.matchesLost})`;
    }
    if ((otherTeam.matchesLost || 0) < (team.matchesLost || 0)) {
      return `More losses (${team.matchesLost} vs ${otherTeam.matchesLost})`;
    }

    // 5. Alphabetical
    return `Alphabetical order`;
  };

  // Sort teams with tie-breaking logic
  const sortTeamsWithTieBreaker = (teams, matches) => {
    return [...teams].sort((a, b) => {
      // 1. Primary: Points (descending)
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }

      // 2. Tie-breaker 1: Net Run Rate (NRR) - Higher NRR ranks higher
      const aNRR = calculateNRR(a._id, matches);
      const bNRR = calculateNRR(b._id, matches);
      if (Math.abs(bNRR - aNRR) > 0.001) { // Use small epsilon for float comparison
        return bNRR - aNRR;
      }

      // 3. Tie-breaker 2: Number of wins (more wins = higher rank)
      if ((b.matchesWon || 0) !== (a.matchesWon || 0)) {
        return (b.matchesWon || 0) - (a.matchesWon || 0);
      }

      // 4. Tie-breaker 3: Win percentage (wins / matches played)
      const aWinRate = (a.matchesPlayed || 0) > 0 ? (a.matchesWon || 0) / (a.matchesPlayed || 1) : 0;
      const bWinRate = (b.matchesPlayed || 0) > 0 ? (b.matchesWon || 0) / (b.matchesPlayed || 1) : 0;
      if (bWinRate !== aWinRate) {
        return bWinRate - aWinRate;
      }

      // 5. Tie-breaker 4: Fewer losses (less losses = higher rank)
      if ((a.matchesLost || 0) !== (b.matchesLost || 0)) {
        return (a.matchesLost || 0) - (b.matchesLost || 0);
      }

      // 6. Tie-breaker 5: Head-to-head record
      const h2hResult = getHeadToHeadResult(a._id, b._id, matches);
      if (h2hResult !== 0) {
        return h2hResult; // Negative if a wins more, positive if b wins more
      }

      // 7. Last resort: Alphabetical order
      return a.name.localeCompare(b.name);
    });
  };

  // Helper function to get player names from team
  const getPlayerNames = (team) => {
    if (!team) return [];
    
    // If players are populated (objects with name property)
    if (team.players && Array.isArray(team.players) && team.players.length > 0) {
      if (team.players[0] && typeof team.players[0] === 'object' && team.players[0].name) {
        return team.players.map(p => p.name);
      }
    }
    
    // Fallback: try to find team in teams array and get players from there
    const teamFromState = teams.find(t => 
      t._id?.toString() === team._id?.toString() || 
      t._id?.toString() === team.toString()
    );
    
    if (teamFromState && teamFromState.players) {
      if (Array.isArray(teamFromState.players) && teamFromState.players.length > 0) {
        if (teamFromState.players[0] && typeof teamFromState.players[0] === 'object' && teamFromState.players[0].name) {
          return teamFromState.players.map(p => p.name);
        }
      }
    }
    
    return [];
  };

  // Get head-to-head result between two teams
  const getHeadToHeadResult = (team1Id, team2Id, matches) => {
    // Find completed matches between these two teams
    const h2hMatches = matches.filter(match => 
      match.status === 'completed' &&
      match.winner &&
      ((match.team1?._id?.toString() === team1Id.toString() && match.team2?._id?.toString() === team2Id.toString()) ||
       (match.team1?._id?.toString() === team2Id.toString() && match.team2?._id?.toString() === team1Id.toString()))
    );

    if (h2hMatches.length === 0) {
      return 0; // No head-to-head, no advantage
    }

    // Count wins for each team
    let team1Wins = 0;
    let team2Wins = 0;

    h2hMatches.forEach(match => {
      const winnerId = match.winner?._id?.toString();
      if (winnerId === team1Id.toString()) {
        team1Wins++;
      } else if (winnerId === team2Id.toString()) {
        team2Wins++;
      }
    });

    // Return negative if team1 wins more, positive if team2 wins more
    if (team1Wins > team2Wins) return -1;
    if (team2Wins > team1Wins) return 1;
    return 0; // Equal head-to-head
  };

  const renderMatchScorecard = (match) => {
    const { team1Wins, team2Wins } = calculateSetWins(match);
    const isCompleted = match.status === 'completed';
    const winner = match.winner;
    const hasTeam2 = match.team2 && match.team2._id;
    const sortedScores = match.scores && Array.isArray(match.scores) 
      ? [...match.scores].sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0))
      : [];
    
    // Get player names for both teams
    const team1Players = getPlayerNames(match.team1);
    const team2Players = hasTeam2 ? getPlayerNames(match.team2) : [];

    return (
      <div className={`match-card ${getMatchTypeClass(match.matchType)}`} style={{ marginBottom: '15px', width: '100%', maxWidth: '100%' }}>
        {/* Cricket Style Scorecard Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: windowWidth < 480 ? '12px' : '15px',
          borderRadius: '8px 8px 0 0',
          marginBottom: '0'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: windowWidth < 480 ? 'flex-start' : 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ flex: 1, minWidth: windowWidth < 480 ? '100%' : 'auto' }}>
              <div style={{ fontSize: windowWidth < 480 ? '11px' : '14px', opacity: 0.9, marginBottom: '5px' }}>
                {match.matchType === 'final' ? '🏆 FINAL' : 
                 match.matchType === 'semifinal' ? '🥈 SEMI-FINAL' : 
                 '📋 GROUP MATCH'}
              </div>
              <div style={{ fontSize: windowWidth < 480 ? '16px' : '20px', fontWeight: 'bold', wordBreak: 'break-word' }}>
                {match.team1?.name} {hasTeam2 ? 'vs' : 'vs (TBD)'} {match.team2?.name || ''}
              </div>
              {/* Player Names */}
              {(team1Players.length > 0 || team2Players.length > 0) && (
                <div style={{ 
                  fontSize: windowWidth < 480 ? '10px' : '12px', 
                  opacity: 0.85, 
                  marginTop: '8px', 
                  display: 'flex', 
                  gap: windowWidth < 480 ? '8px' : '15px', 
                  flexWrap: 'wrap' 
                }}>
                  {team1Players.length > 0 && (
                    <div style={{ wordBreak: 'break-word' }}>
                      <span style={{ fontWeight: '600' }}>{match.team1?.name}:</span>{' '}
                      {team1Players.join(', ')}
                    </div>
                  )}
                  {hasTeam2 && team2Players.length > 0 && (
                    <div style={{ wordBreak: 'break-word' }}>
                      <span style={{ fontWeight: '600' }}>{match.team2?.name}:</span>{' '}
                      {team2Players.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: windowWidth < 480 ? 'left' : 'right', flexShrink: 0 }}>
              {getMatchStatusBadge(match.status)}
              {isCompleted && winner && (
                <div style={{ marginTop: '5px', fontSize: windowWidth < 480 ? '10px' : '12px', opacity: 0.9, wordBreak: 'break-word' }}>
                  Winner: {winner.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cricket Style Scorecard Body */}
        <div style={{ background: '#f8f9fa', padding: windowWidth < 480 ? '12px' : '15px', borderRadius: '0 0 8px 8px', width: '100%', overflow: 'hidden' }}>
          {/* Cricket Style Sets Table */}
          {sortedScores.length > 0 ? (
            <div style={{ marginBottom: '15px', width: '100%' }}>
              <div style={{ 
                fontSize: windowWidth < 480 ? '12px' : '14px', 
                fontWeight: 'bold', 
                marginBottom: '10px',
                color: '#333',
                paddingBottom: '8px',
                borderBottom: '2px solid #dee2e6'
              }}>
                Sets Breakdown
              </div>
              
              {/* Cricket Style Table - Responsive wrapper */}
              <div className="table-responsive" style={{ 
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                maxWidth: '100%',
                display: 'block',
                margin: windowWidth < 480 ? '0 -12px' : '0',
                padding: windowWidth < 480 ? '0 12px' : '0'
              }}>
                <table style={{ 
                  width: '100%', 
                  minWidth: windowWidth < 480 ? '500px' : '100%',
                  borderCollapse: 'collapse',
                  background: 'white',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  margin: 0
                }}>
                  <thead>
                    <tr style={{ background: '#343a40', color: 'white' }}>
                      <th style={{ padding: windowWidth < 480 ? '8px' : '12px', textAlign: 'left', fontSize: windowWidth < 480 ? '11px' : '13px', fontWeight: '600' }}>Set</th>
                      <th style={{ padding: windowWidth < 480 ? '8px' : '12px', textAlign: 'center', fontSize: windowWidth < 480 ? '11px' : '13px', fontWeight: '600', wordBreak: 'break-word' }}>{match.team1?.name}</th>
                      {hasTeam2 && (
                        <th style={{ padding: windowWidth < 480 ? '8px' : '12px', textAlign: 'center', fontSize: windowWidth < 480 ? '11px' : '13px', fontWeight: '600', wordBreak: 'break-word' }}>{match.team2?.name}</th>
                      )}
                      <th style={{ padding: windowWidth < 480 ? '8px' : '12px', textAlign: 'center', fontSize: windowWidth < 480 ? '11px' : '13px', fontWeight: '600' }}>Result</th>
                    </tr>
                  </thead>
                <tbody>
                  {sortedScores.map((score, idx) => {
                    const team1Score = parseInt(score.team1Score) || 0;
                    const team2Score = parseInt(score.team2Score) || 0;
                    const team1Won = team1Score > team2Score;
                    const team2Won = hasTeam2 && team2Score > team1Score;
                    
                    return (
                      <tr 
                        key={idx}
                        style={{ 
                          borderBottom: '1px solid #dee2e6',
                          background: idx % 2 === 0 ? '#ffffff' : '#f8f9fa'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = team1Won ? '#e8f5e9' : team2Won ? '#ffebee' : '#e9ecef'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                      >
                        <td style={{ padding: windowWidth < 480 ? '8px' : '12px', fontWeight: 'bold', color: '#495057', fontSize: windowWidth < 480 ? '12px' : '14px' }}>
                          Set {score.setNumber}
                        </td>
                        <td style={{ 
                          padding: windowWidth < 480 ? '8px' : '12px', 
                          textAlign: 'center',
                          fontWeight: team1Won ? 'bold' : 'normal',
                          color: team1Won ? '#28a745' : '#495057',
                          fontSize: windowWidth < 480 ? '14px' : '16px'
                        }}>
                          <span style={{ 
                            display: 'inline-block',
                            padding: windowWidth < 480 ? '3px 6px' : '4px 8px',
                            borderRadius: '4px',
                            background: team1Won ? '#d4edda' : 'transparent'
                          }}>
                            {team1Score}
                            {team1Won && <span style={{ marginLeft: '5px', color: '#28a745' }}>✓</span>}
                          </span>
                        </td>
                        {hasTeam2 && (
                          <td style={{ 
                            padding: windowWidth < 480 ? '8px' : '12px', 
                            textAlign: 'center',
                            fontWeight: team2Won ? 'bold' : 'normal',
                            color: team2Won ? '#28a745' : '#495057',
                            fontSize: windowWidth < 480 ? '14px' : '16px'
                          }}>
                            <span style={{ 
                              display: 'inline-block',
                              padding: windowWidth < 480 ? '3px 6px' : '4px 8px',
                              borderRadius: '4px',
                              background: team2Won ? '#d4edda' : 'transparent'
                            }}>
                              {team2Score}
                              {team2Won && <span style={{ marginLeft: '5px', color: '#28a745' }}>✓</span>}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: windowWidth < 480 ? '8px' : '12px', textAlign: 'center', fontSize: windowWidth < 480 ? '11px' : '13px', wordBreak: 'break-word' }}>
                          {team1Won ? (
                            <span style={{ 
                              color: '#28a745', 
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: '#d4edda'
                            }}>{match.team1?.name} won</span>
                          ) : team2Won ? (
                            <span style={{ 
                              color: '#28a745', 
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: '#d4edda'
                            }}>{match.team2?.name} won</span>
                          ) : (
                            <span style={{ color: '#6c757d' }}>Tie</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Summary Row - Cricket Style */}
                  <tr style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    borderTop: '3px solid #495057'
                  }}>
                    <td style={{ padding: windowWidth < 480 ? '10px' : '14px', fontSize: windowWidth < 480 ? '12px' : '14px' }}>Total</td>
                    <td style={{ 
                      padding: windowWidth < 480 ? '10px' : '14px', 
                      textAlign: 'center',
                      fontSize: windowWidth < 480 ? '16px' : '18px'
                    }}>
                      {team1Wins} sets
                    </td>
                    {hasTeam2 && (
                      <td style={{ 
                        padding: windowWidth < 480 ? '10px' : '14px', 
                        textAlign: 'center',
                        fontSize: windowWidth < 480 ? '16px' : '18px'
                      }}>
                        {team2Wins} sets
                      </td>
                    )}
                    <td style={{ padding: windowWidth < 480 ? '10px' : '14px', textAlign: 'center', fontSize: windowWidth < 480 ? '12px' : '14px', wordBreak: 'break-word' }}>
                      {isCompleted && winner ? (
                        <span style={{ 
                          background: 'rgba(255,255,255,0.2)',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}>🏆 {winner.name}</span>
                      ) : (
                        <span>
                          {team1Wins > team2Wins ? `${match.team1?.name} leads` :
                           team2Wins > team1Wins ? `${match.team2?.name} leads` :
                           'Tied'}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: windowWidth < 480 ? '15px' : '20px', 
              textAlign: 'center',
              color: '#999',
              fontStyle: 'italic',
              background: 'white',
              borderRadius: '5px',
              border: '1px dashed #dee2e6',
              fontSize: windowWidth < 480 ? '12px' : '14px'
            }}>
              No scores added yet. Click "Add Score" to start recording.
            </div>
          )}

          {/* Toss Information */}
          {match.tossWinner && (
            <div style={{ 
              marginTop: '10px', 
              padding: windowWidth < 480 ? '8px' : '10px', 
              background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
              borderRadius: '5px',
              border: '2px solid #ffc107',
              display: 'flex',
              alignItems: 'center',
              gap: windowWidth < 480 ? '8px' : '10px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: windowWidth < 480 ? '16px' : '20px' }}>🪙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: windowWidth < 480 ? '12px' : '14px', color: '#333' }}>Toss Winner:</strong>
                <div style={{ fontSize: windowWidth < 480 ? '13px' : '15px', color: '#555', marginTop: '2px', fontWeight: 'bold', wordBreak: 'break-word' }}>
                  {match.tossWinner?.name || 'Unknown'}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: windowWidth < 480 ? '6px' : '10px', 
            marginTop: '10px', 
            flexWrap: 'wrap',
            width: '100%'
          }}>
            {match.status !== 'completed' && hasTeam2 && (
              <>
                {!match.tossWinner && (
                  <button 
                    className="btn btn-warning" 
                    onClick={() => handleToss(match)}
                    disabled={loading.toss === match._id}
                    style={{ 
                      background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                      color: '#333',
                      fontWeight: 'bold',
                      border: '2px solid #ffc107',
                      padding: windowWidth < 480 ? '8px 12px' : '10px 16px',
                      fontSize: windowWidth < 480 ? '12px' : '14px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {loading.toss === match._id ? '⏳ Tossing...' : '🪙 Toss'}
                  </button>
                )}
                <button 
                  className="btn btn-primary" 
                  onClick={() => openScoreModal(match)}
                  style={{
                    padding: windowWidth < 480 ? '8px 12px' : '10px 16px',
                    fontSize: windowWidth < 480 ? '12px' : '14px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Add Score
                </button>
                {match.scores && match.scores.length > 0 && (
                  <button 
                    className="btn btn-success" 
                    disabled={loading.markComplete === match._id}
                    style={{
                      padding: windowWidth < 480 ? '8px 12px' : '10px 16px',
                      fontSize: windowWidth < 480 ? '12px' : '14px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={async () => {
                      const { team1Wins, team2Wins } = calculateSetWins(match);
                      if (team1Wins === team2Wins) {
                        alert('Cannot determine winner - both teams have equal sets won. Please add more scores.');
                        return;
                      }
                      const winner = team1Wins > team2Wins ? match.team1 : match.team2;
                      const winnerWins = team1Wins > team2Wins ? team1Wins : team2Wins;
                      
                      setLoading({ ...loading, markComplete: match._id });
                      try {
                        console.log('Completing match:', {
                          matchId: match._id,
                          winnerId: winner._id,
                          winnerName: winner.name,
                          team1Wins,
                          team2Wins
                        });
                        
                        const response = await updateMatch(match._id, {
                          status: 'completed',
                          winner: winner._id
                        });
                        
                        console.log('Match completed response:', response.data);
                        
                        // Check if this is the final match
                        if (match.matchType === 'final') {
                          // Set winner team for animation
                          const winnerTeamData = teams.find(t => {
                            const teamId = t._id ? t._id.toString() : t.toString();
                            const winnerId = winner._id ? winner._id.toString() : winner.toString();
                            return teamId === winnerId;
                          });
                          if (winnerTeamData) {
                            setWinnerTeam(winnerTeamData);
                            setShowWinnerAnimation(true);
                            // Auto-hide after 8 seconds
                            setTimeout(() => {
                              setShowWinnerAnimation(false);
                            }, 8000);
                          }
                        }
                        
                        // Force reload all data to get updated team stats
                        await loadData();
                      } catch (error) {
                        console.error('Error completing match:', error);
                        alert('Failed to complete match: ' + (error.response?.data?.error || error.message));
                      } finally {
                        setLoading({ ...loading, markComplete: null });
                      }
                    }}
                  >
                    {loading.markComplete === match._id ? '⏳ Completing...' : '✓ Mark Complete'}
                  </button>
                )}
              </>
            )}
            {/* Delete button - show for all matches except if tournament is completed */}
            {tournament && tournament.status !== 'completed' && (
              <button 
                className="btn btn-danger" 
                onClick={() => handleMatchDelete(match._id)}
                disabled={loading.deleteMatch === match._id}
                style={{ 
                  marginLeft: windowWidth < 480 ? '0' : 'auto',
                  padding: windowWidth < 480 ? '8px 12px' : '10px 16px',
                  fontSize: windowWidth < 480 ? '12px' : '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                {loading.deleteMatch === match._id ? '⏳ Deleting...' : '🗑️ Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loadingData || !tournament) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading tournament data...</div>
      </div>
    );
  }

  // Get semi-finals in the correct order (matching tournament.semiFinalMatches array)
  let semiFinals = [];
  
  if (tournament?.semiFinalMatches && tournament.semiFinalMatches.length > 0) {
    // Try to match by tournament.semiFinalMatches array order
    semiFinals = tournament.semiFinalMatches
      .map(matchId => {
        const matchIdStr = matchId?._id ? matchId._id.toString() : matchId?.toString();
        return matches.find(m => {
          const mIdStr = m._id?.toString();
          return mIdStr === matchIdStr;
        });
      })
      .filter(m => m !== undefined);
    
    // If no matches found via tournament array, fall back to filtering by matchType
    if (semiFinals.length === 0) {
      semiFinals = matches.filter(m => m.matchType === 'semifinal');
    }
  } else {
    // Fall back to filtering by matchType if tournament array is empty
    semiFinals = matches.filter(m => m.matchType === 'semifinal');
  }
  
  console.log('Semi-finals to display:', semiFinals.map(m => ({ 
    id: m._id, 
    team1: m.team1?.name, 
    team2: m.team2?.name, 
    matchType: m.matchType 
  })));
  
  const finalMatch = matches.find(m => m.matchType === 'final');
  const groupMatches = matches.filter(m => m.matchType === 'group');
  
  // Helper function to get winner - handles both populated objects and ObjectIds
  const getTournamentWinner = () => {
    // First try tournament.winner (populated or ObjectId)
    if (tournament.winner) {
      let winnerTeam = null;
      
      // If it's a populated object with name
      if (tournament.winner.name) {
        winnerTeam = tournament.winner;
      }
      // If it's an ObjectId string, try to find the team
      else if (typeof tournament.winner === 'string') {
        winnerTeam = teams.find(t => t._id === tournament.winner || t._id.toString() === tournament.winner);
      }
      // If it's an ObjectId object, try to find the team
      else if (tournament.winner._id) {
        winnerTeam = teams.find(t => t._id.toString() === tournament.winner._id.toString());
      }
      
      // If we found a team but it doesn't have players, try to get it from teams array
      if (winnerTeam && (!winnerTeam.players || !Array.isArray(winnerTeam.players) || winnerTeam.players.length === 0)) {
        const teamId = winnerTeam._id ? winnerTeam._id.toString() : winnerTeam.toString();
        const teamWithPlayers = teams.find(t => {
          const tId = t._id ? t._id.toString() : t.toString();
          return tId === teamId;
        });
        if (teamWithPlayers && teamWithPlayers.players) {
          return teamWithPlayers;
        }
      }
      
      if (winnerTeam) {
        return winnerTeam;
      }
    }
    
    // Fallback: get winner from final match if tournament winner is not set
    if (finalMatch && finalMatch.status === 'completed' && finalMatch.winner) {
      let winnerTeam = null;
      
      if (finalMatch.winner.name) {
        winnerTeam = finalMatch.winner;
      } else {
        // If winner is ObjectId, find the team
        const winnerId = finalMatch.winner._id || finalMatch.winner;
        winnerTeam = teams.find(t => t._id.toString() === winnerId.toString());
      }
      
      // If we found a team but it doesn't have players, try to get it from teams array
      if (winnerTeam && (!winnerTeam.players || !Array.isArray(winnerTeam.players) || winnerTeam.players.length === 0)) {
        const teamId = winnerTeam._id ? winnerTeam._id.toString() : winnerTeam.toString();
        const teamWithPlayers = teams.find(t => {
          const tId = t._id ? t._id.toString() : t.toString();
          return tId === teamId;
        });
        if (teamWithPlayers && teamWithPlayers.players) {
          return teamWithPlayers;
        }
      }
      
      if (winnerTeam) {
        return winnerTeam;
      }
    }
    
    return null;
  };
  
  const tournamentWinner = getTournamentWinner();
  
  // Filter matches to only completed GROUP matches with scores (points table only uses group matches)
  const completedMatchesWithScores = matches.filter(m => 
    m.status === 'completed' && 
    m.matchType === 'group' &&  // Only group matches for points table
    m.scores && 
    Array.isArray(m.scores) && 
    m.scores.length > 0
  );

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '100%',
      padding: windowWidth < 480 ? '0 10px' : '0 20px',
      boxSizing: 'border-box'
    }}>
      <div style={{ marginBottom: windowWidth < 480 ? '15px' : '20px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: '10px', padding: windowWidth < 480 ? '6px 12px' : '8px 16px', fontSize: windowWidth < 480 ? '12px' : '14px' }}>
          ← Back to Tournaments
        </button>
        
        {/* Tournament Header with Status and Winner */}
        <div style={{ 
          background: tournament.status === 'completed' 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
            : tournament.status === 'ongoing'
            ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          padding: windowWidth < 480 ? '15px' : '25px',
          borderRadius: '10px',
          marginBottom: windowWidth < 480 ? '15px' : '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ flex: 1, minWidth: windowWidth < 480 ? '100%' : '200px' }}>
              <h1 style={{ margin: '0 0 10px 0', fontSize: windowWidth < 480 ? '22px' : windowWidth < 768 ? '26px' : '32px', fontWeight: 'bold', wordBreak: 'break-word' }}>
                {tournament.name}
              </h1>
              <p style={{ margin: '5px 0', opacity: 0.9, fontSize: windowWidth < 480 ? '13px' : '16px', wordBreak: 'break-word' }}>
                {tournament.description || 'No description'}
              </p>
              <div style={{ marginTop: '15px', display: 'flex', gap: windowWidth < 480 ? '10px' : '20px', flexWrap: 'wrap' }}>
                <div>
                  <strong>Status:</strong> 
                  <span style={{ 
                    marginLeft: '8px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.2)',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {tournament.status}
                  </span>
                </div>
                <div>
                  <strong>Start:</strong> {new Date(tournament.startDate).toLocaleDateString()}
                </div>
                <div>
                  <strong>End:</strong> {new Date(tournament.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            {/* Winner Display */}
            {tournamentWinner && (() => {
              // Always try to get the team from teams array which has players populated
              const winnerTeamId = tournamentWinner._id ? tournamentWinner._id.toString() : tournamentWinner.toString();
              const winnerTeamWithPlayers = teams.find(t => {
                const teamId = t._id ? t._id.toString() : t.toString();
                return teamId === winnerTeamId;
              }) || tournamentWinner;
              
              // Helper function to get player names from a team
              const getPlayerNames = (team) => {
                if (!team || !team.players) return '';
                if (!Array.isArray(team.players)) return '';
                
                const names = team.players
                  .map(p => {
                    // If player is an object with name property
                    if (p && typeof p === 'object' && p.name) {
                      return p.name;
                    }
                    // If player is a string and not an ObjectId (24 hex chars)
                    if (typeof p === 'string' && !/^[0-9a-fA-F]{24}$/.test(p)) {
                      return p;
                    }
                    return null;
                  })
                  .filter(name => name !== null && name !== undefined && name !== '');
                
                return names.join(', ');
              };
              
              const playerNames = getPlayerNames(winnerTeamWithPlayers);
              
              return (
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  minWidth: '200px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>🏆 TOURNAMENT WINNER</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: playerNames ? '8px' : '0' }}>
                    {tournamentWinner.name || tournamentWinner}
                  </div>
                  {playerNames && playerNames.length > 0 && (
                    <div style={{ 
                      fontSize: '12px', 
                      opacity: 0.85,
                      fontStyle: 'italic',
                      marginTop: '5px'
                    }}>
                      {playerNames}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Points Table (Left) and Other Content (Right) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1.2fr', 
        gap: windowWidth < 768 ? '15px' : '20px',
        alignItems: 'start',
        width: '100%',
        maxWidth: '100%'
      }}>
        {/* Left Column: Points Table / Scoreboard - Fixed */}
        <div style={{ 
          position: windowWidth < 768 ? 'relative' : 'sticky',
          top: windowWidth < 768 ? '0' : '20px',
          alignSelf: 'start',
          width: '100%',
          maxHeight: windowWidth < 768 ? 'none' : 'calc(100vh - 100px)',
          overflowY: windowWidth < 768 ? 'visible' : 'auto',
          overflowX: 'visible'
        }}>
          <div className="card" style={{ 
            display: 'flex',
            flexDirection: 'column',
            padding: windowWidth < 480 ? '15px' : '20px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h2 style={{ fontSize: windowWidth < 480 ? '18px' : '22px', marginBottom: '15px' }}>📊 Points Table</h2>
        {teams.length === 0 ? (
          <p style={{ fontSize: windowWidth < 480 ? '13px' : '14px' }}>No teams added yet. Go to Teams page to create teams for this tournament.</p>
        ) : windowWidth < 480 ? (
          // Mobile Card Layout for very small screens
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(() => {
              const sortedTeams = sortTeamsWithTieBreaker(teams, completedMatchesWithScores);
              // Helper to check if team is tied with adjacent teams
              const isTied = (index) => {
                if (index >= sortedTeams.length - 1) return false;
                const team = sortedTeams[index];
                const nextTeam = sortedTeams[index + 1];
                const teamNRR = calculateNRR(team._id, completedMatchesWithScores);
                const nextNRR = calculateNRR(nextTeam._id, completedMatchesWithScores);
                
                if (team.points === nextTeam.points && 
                    Math.abs(teamNRR - nextNRR) < 0.001 &&
                    team.matchesWon === nextTeam.matchesWon &&
                    team.matchesLost === nextTeam.matchesLost) {
                  const h2h = getHeadToHeadResult(team._id, nextTeam._id, completedMatchesWithScores);
                  return h2h === 0; // Truly tied if head-to-head is also tied
                }
                return false;
              };
              
              return sortedTeams.map((team, index) => {
                const isTopThree = index < 3;
                const position = index + 1;
                const nrr = calculateNRR(team._id, completedMatchesWithScores);
                const nrrColor = nrr > 0 ? '#4caf50' : nrr < 0 ? '#f44336' : '#666';
                const tied = isTied(index);
              
              return (
                <div
                  key={team._id}
                  style={{
                    background: isTopThree ? '#e8f5e9' : 'white',
                    border: isTopThree ? '3px solid #4caf50' : '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', minWidth: '30px' }}>
                        {position === 1 && '🥇'}
                        {position === 2 && '🥈'}
                        {position === 3 && '🥉'}
                        {position > 3 && position}
                        {tied && <span style={{ color: '#ff9800', fontSize: '12px', marginLeft: '3px' }} title="Tied with next team">=</span>}
                      </span>
                      <strong style={{ fontSize: '14px', flex: 1 }}>{team.name}</strong>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976d2' }}>
                      {team.points || 0} pts
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '6px' }}>
                    <div>
                      <span style={{ color: '#666' }}>P: </span>
                      <strong>{team.matchesPlayed || 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#666' }}>W: </span>
                      <strong style={{ color: '#4caf50' }}>{team.matchesWon || 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#666' }}>L: </span>
                      <strong style={{ color: '#f44336' }}>{team.matchesLost || 0}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666' }}>
                    <div>
                      <span style={{ color: '#666' }}>NRR: </span>
                      <span style={{ color: nrrColor, fontWeight: 'bold' }}>
                        {nrr > 0 ? '+' : ''}{nrr.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {team.players?.slice(0, 2).map((p, idx) => (
                        <span key={p._id}>
                          {p.name}
                          {idx < Math.min(team.players.length - 1, 1) ? ', ' : ''}
                        </span>
                      ))}
                      {team.players?.length > 2 && '...'}
                    </div>
                  </div>
                </div>
              );
              });
            })()}
          </div>
        ) : (
          // Table Layout for larger screens
          <div className="table-responsive" style={{ 
            overflowX: 'auto', 
            WebkitOverflowScrolling: 'touch',
            width: '100%',
            maxWidth: '100%'
          }}>
          <table className="table" style={{ 
            width: '100%',
            minWidth: windowWidth < 768 ? '550px' : '100%', 
            fontSize: windowWidth < 768 ? '11px' : '14px',
            tableLayout: windowWidth < 768 ? 'auto' : 'fixed'
          }}>
            <thead>
              <tr>
                <th style={{ width: windowWidth < 768 ? '35px' : '50px', padding: windowWidth < 768 ? '6px' : '12px' }}>Pos</th>
                <th style={{ padding: windowWidth < 768 ? '6px' : '12px' }}>Team</th>
                <th style={{ textAlign: 'center', width: windowWidth < 768 ? '30px' : 'auto', padding: windowWidth < 768 ? '6px' : '12px' }}>P</th>
                <th style={{ textAlign: 'center', width: windowWidth < 768 ? '30px' : 'auto', padding: windowWidth < 768 ? '6px' : '12px' }}>W</th>
                <th style={{ textAlign: 'center', width: windowWidth < 768 ? '30px' : 'auto', padding: windowWidth < 768 ? '6px' : '12px' }}>L</th>
                <th style={{ textAlign: 'center', fontWeight: 'bold', width: windowWidth < 768 ? '40px' : 'auto', padding: windowWidth < 768 ? '6px' : '12px' }}>Pts</th>
                {windowWidth >= 640 && (
                  <th style={{ textAlign: 'center', fontSize: windowWidth < 768 ? '10px' : '12px', width: windowWidth < 768 ? '50px' : 'auto', padding: windowWidth < 768 ? '6px' : '12px' }}>NRR</th>
                )}
                {windowWidth >= 768 && (
                  <th style={{ padding: windowWidth < 768 ? '6px' : '12px' }}>Players</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const sortedTeams = sortTeamsWithTieBreaker(teams, completedMatchesWithScores);
                // Helper to check if team is tied with adjacent teams
                const isTied = (index) => {
                  if (index >= sortedTeams.length - 1) return false;
                  const team = sortedTeams[index];
                  const nextTeam = sortedTeams[index + 1];
                  const teamNRR = calculateNRR(team._id, completedMatchesWithScores);
                  const nextNRR = calculateNRR(nextTeam._id, completedMatchesWithScores);
                  
                  if (team.points === nextTeam.points && 
                      Math.abs(teamNRR - nextNRR) < 0.001 &&
                      team.matchesWon === nextTeam.matchesWon &&
                      team.matchesLost === nextTeam.matchesLost) {
                    const h2h = getHeadToHeadResult(team._id, nextTeam._id, completedMatchesWithScores);
                    return h2h === 0; // Truly tied if head-to-head is also tied
                  }
                  return false;
                };
                
                return sortedTeams.map((team, index) => {
                  const isTopThree = index < 3;
                  const position = index + 1;
                  const tied = isTied(index);
                
                return (
                  <tr 
                    key={team._id}
                    style={{ 
                      backgroundColor: isTopThree ? '#e8f5e9' : 'transparent',
                      fontWeight: isTopThree ? '600' : 'normal',
                      borderLeft: isTopThree ? '4px solid #4caf50' : 'none'
                    }}
                  >
                    <td style={{ padding: windowWidth < 768 ? '6px' : '12px' }}>
                      {position === 1 && <span style={{ color: '#ffd700', marginRight: '3px' }}>🥇</span>}
                      {position === 2 && <span style={{ color: '#c0c0c0', marginRight: '3px' }}>🥈</span>}
                      {position === 3 && <span style={{ color: '#cd7f32', marginRight: '3px' }}>🥉</span>}
                      {position > 3 && position}
                      {tied && <span style={{ color: '#ff9800', fontSize: '10px', marginLeft: '3px' }} title="Tied with next team">=</span>}
                      {isTopThree && windowWidth >= 640 && <span style={{ marginLeft: '3px', color: '#4caf50' }}>✓</span>}
                    </td>
                    <td style={{ padding: windowWidth < 768 ? '6px' : '12px' }}>
                      <strong style={{ fontSize: windowWidth < 768 ? '11px' : '14px' }}>{team.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center', padding: windowWidth < 768 ? '6px' : '12px' }}>{team.matchesPlayed || 0}</td>
                    <td style={{ textAlign: 'center', color: '#4caf50', fontWeight: 'bold', padding: windowWidth < 768 ? '6px' : '12px' }}>{team.matchesWon || 0}</td>
                    <td style={{ textAlign: 'center', color: '#f44336', fontWeight: 'bold', padding: windowWidth < 768 ? '6px' : '12px' }}>{team.matchesLost || 0}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: windowWidth < 768 ? '14px' : '18px', color: '#1976d2', padding: windowWidth < 768 ? '6px' : '12px' }}>{team.points || 0}</td>
                    {windowWidth >= 640 && (
                      <td style={{ textAlign: 'center', fontSize: windowWidth < 768 ? '10px' : '13px', fontWeight: 'bold', color: '#666', padding: windowWidth < 768 ? '6px 4px' : '8px 4px' }}>
                        {(() => {
                          const nrr = calculateNRR(team._id, completedMatchesWithScores);
                          const nrrColor = nrr > 0 ? '#4caf50' : nrr < 0 ? '#f44336' : '#666';
                          return (
                            <span style={{ color: nrrColor }}>
                              {nrr > 0 ? '+' : ''}{nrr.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {windowWidth >= 768 && (
                      <td style={{ fontSize: windowWidth < 768 ? '11px' : '12px', color: '#666', padding: windowWidth < 768 ? '6px' : '12px' }}>
                        {team.players?.map((p, idx) => (
                          <span key={p._id}>
                            {p.name}
                            {idx < team.players.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </td>
                    )}
                  </tr>
                );
                });
              })()}
            </tbody>
          </table>
          </div>
        )}
        {teams.length >= 3 && (
          <div style={{ marginTop: '15px', padding: '10px', background: '#fff3cd', borderRadius: '5px', fontSize: '14px' }}>
            <strong>ℹ️ Top 3 teams qualify for Semi-Finals & Final</strong>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#856404' }}>
              • Semi-Final 1: 🥇 1st Place vs 🥈 2nd Place<br/>
              • Semi-Final 2: 🥉 3rd Place vs (Semi 1 Loser)<br/>
              • Final: Semi 1 Winner vs Semi 2 Winner
            </div>
          </div>
        )}

        {/* Tournament Management Section */}
        <div className="card" style={{ marginTop: '20px', marginBottom: '20px', width: '100%' }}>
          <h3>Tournament Management</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold' }}>Update Status:</label>
            <select
              value={tournament.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                setPendingAction(() => async () => {
                  try {
                    await updateTournament(id, { status: newStatus });
                    await loadData();
                    alert(`Tournament status updated to ${newStatus}`);
                  } catch (error) {
                    console.error('Error updating tournament status:', error);
                    alert('Failed to update tournament status');
                  }
                });
                setPendingActionType('update-tournament');
                setShowPinModal(true);
              }}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ddd' }}
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
            {tournament.status === 'completed' && !tournamentWinner && (
              <div style={{ 
                padding: '10px', 
                background: '#fff3cd', 
                borderRadius: '5px', 
                fontSize: '14px',
                color: '#856404',
                width: '100%',
                marginTop: '10px'
              }}>
                ⚠️ Tournament is marked as completed but no winner is set. Complete the final match to set the winner automatically.
              </div>
            )}
          </div>
        </div>

        {/* Group Matches Generation */}
        {teams.length >= 2 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2>Group Matches</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {groupMatches.length === 0 ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleGenerateGroupMatches}
                  disabled={loading.generateGroupMatches}
                >
                  {loading.generateGroupMatches ? '⏳ Generating...' : '⚡ Generate All Group Matches'}
                </button>
              ) : (
                <>
                  <span style={{ color: '#666', fontSize: '14px' }}>
                    {groupMatches.length} group match(es) already created
                  </span>
                  <button 
                    className="btn btn-warning" 
                    onClick={handleGenerateGroupMatches}
                    disabled={loading.generateGroupMatches}
                    style={{ background: '#ffc107', color: '#000', border: 'none' }}
                  >
                    {loading.generateGroupMatches ? '⏳ Regenerating...' : '🔄 Regenerate Group Matches'}
                  </button>
                </>
              )}
              <div style={{ fontSize: '13px', color: '#666', marginLeft: '10px', width: '100%' }}>
                {teams.length >= 2 && (
                  <span>
                    Will generate {teams.length * (teams.length - 1) / 2} match(es) (round-robin: each team plays every other team once)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {teams.length >= 3 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2>Tournament Actions</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {semiFinals.length === 0 ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleGenerateSemiFinals}
                  disabled={loading.generateSemiFinals}
                >
                  {loading.generateSemiFinals ? '⏳ Generating...' : 'Generate Semi-Final (Top 3 Teams)'}
                </button>
              ) : (
                <button 
                  className="btn btn-warning" 
                  onClick={async () => {
                    await handleGenerateSemiFinals();
                  }}
                  style={{ background: '#ffc107', color: '#000', border: 'none' }}
                >
                  🔄 Regenerate Semi-Finals
                </button>
              )}
              {semiFinals.length === 2 && semiFinals[0].status === 'completed' && semiFinals[1].team2 === null && (
                <button 
                  className="btn btn-info" 
                  onClick={handleUpdateSemiFinal2} 
                  disabled={loading.updateSemiFinal2}
                  style={{ background: '#17a2b8', color: 'white' }}
                >
                  {loading.updateSemiFinal2 ? '⏳ Updating...' : 'Update Semi-Final 2'}
                </button>
              )}
              {semiFinals.length === 2 && semiFinals.every(m => m.status === 'completed') && !finalMatch && (
                <button 
                  className="btn btn-success" 
                  onClick={handleGenerateFinal}
                  disabled={loading.generateFinal}
                >
                  {loading.generateFinal ? '⏳ Generating...' : 'Generate Final'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowMatchModal(true)}>
                + Create Manual Match
              </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={async () => {
                    setLoading({ ...loading, recalculateStats: true });
                    try {
                      await recalculateTeamStats(id);
                      await loadData();
                    } catch (error) {
                      console.error('Error recalculating stats:', error);
                      alert('Failed to recalculate statistics');
                    } finally {
                      setLoading({ ...loading, recalculateStats: false });
                    }
                  }}
                  disabled={loading.recalculateStats}
                  style={{ background: '#17a2b8', color: 'white' }}
                >
                  {loading.recalculateStats ? '⏳ Recalculating...' : '🔄 Recalculate Stats'}
                </button>
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Right Column: Matches - Scrollable */}
        <div style={{ 
          width: '100%',
          overflowY: 'visible',
          overflowX: 'hidden'
        }}>
          {/* Final Match */}
          {finalMatch && (
            <div className="card" style={{ marginBottom: '20px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <h2 style={{ fontSize: windowWidth < 480 ? '18px' : '24px' }}>🏆 Final Match</h2>
              {renderMatchScorecard(finalMatch)}
            </div>
          )}

          {/* Semi-Finals */}
          {semiFinals.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <h2 style={{ fontSize: windowWidth < 480 ? '18px' : '24px' }}>🥈 Semi-Finals</h2>
              {semiFinals.map((match, index) => (
                <div key={match._id} style={{ width: '100%', maxWidth: '100%' }}>
                  <h3 style={{ 
                    marginBottom: '10px', 
                    color: '#666',
                    fontSize: windowWidth < 480 ? '14px' : '18px'
                  }}>Semi-Final {index + 1}</h3>
                  {renderMatchScorecard(match)}
                  {index === 0 && match.status === 'completed' && (
                    <div style={{ 
                      marginTop: '10px', 
                      padding: windowWidth < 480 ? '6px' : '8px', 
                      background: '#fff3cd', 
                      borderRadius: '5px', 
                      fontSize: windowWidth < 480 ? '11px' : '13px' 
                    }}>
                      ⚠️ Complete Semi-Final 1 first, then update Semi-Final 2 with the loser
                    </div>
                  )}
                  {index === 1 && !match.team2 && (
                    <div style={{ marginTop: '10px', padding: '8px', background: '#ffe6e6', borderRadius: '5px', fontSize: '13px' }}>
                      ⚠️ Waiting for Semi-Final 1 to complete. Click "Update Semi-Final 2" after Semi 1 finishes.
                    </div>
                  )}
                </div>
              ))}
              {semiFinals.length === 2 && semiFinals.every(m => m.status === 'completed') && (
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '5px', fontSize: '14px' }}>
                  <strong>ℹ️ Both semi-finals completed! Generate Final to create the championship match.</strong>
                </div>
              )}
            </div>
          )}

          {/* Group Matches */}
          {groupMatches.length > 0 && (
            <div className="card" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <h2 style={{ fontSize: windowWidth < 480 ? '18px' : '24px' }}>📋 Group Matches</h2>
              {groupMatches.map(match => (
                <div key={match._id} style={{ width: '100%', maxWidth: '100%' }}>
                  {renderMatchScorecard(match)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Match Modal */}
      {showMatchModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create Match</h2>
              <span className="close" onClick={() => setShowMatchModal(false)}>&times;</span>
            </div>
            <form onSubmit={handleCreateMatch}>
              <div className="form-group">
                <label>Team 1 *</label>
                <select
                  required
                  value={matchForm.team1}
                  onChange={(e) => setMatchForm({ ...matchForm, team1: e.target.value })}
                >
                  <option value="">Select Team 1</option>
                  {teams.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Team 2 *</label>
                <select
                  required
                  value={matchForm.team2}
                  onChange={(e) => setMatchForm({ ...matchForm, team2: e.target.value })}
                >
                  <option value="">Select Team 2</option>
                  {teams.filter(t => t._id !== matchForm.team1).map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Match Type</label>
                <select
                  value={matchForm.matchType}
                  onChange={(e) => setMatchForm({ ...matchForm, matchType: e.target.value })}
                >
                  <option value="group">Group</option>
                  <option value="quarterfinal">Quarterfinal</option>
                  <option value="semifinal">Semifinal</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading.createMatch}>
                  {loading.createMatch ? '⏳ Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Score Modal */}
      {showScoreModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add Score</h2>
              <span className="close" onClick={() => {
                setShowScoreModal(null);
                setScoreForm({ setNumber: 10, team1Score: 0, team2Score: 0 });
              }}>&times;</span>
            </div>
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>
                <strong>{showScoreModal.team1?.name}</strong> vs <strong>{showScoreModal.team2?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px', fontSize: '14px', color: '#666' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: '600', marginBottom: '5px', color: '#333' }}>
                    {showScoreModal.team1?.name}
                  </div>
                  <div style={{ fontSize: '13px', fontStyle: 'italic' }}>
                    {(() => {
                      const team1Players = getPlayerNames(showScoreModal.team1);
                      return team1Players.length > 0 ? team1Players.join(', ') : 'No players';
                    })()}
                  </div>
                </div>
                <div style={{ alignSelf: 'center', fontSize: '20px', color: '#999' }}>vs</div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: '600', marginBottom: '5px', color: '#333' }}>
                    {showScoreModal.team2?.name}
                  </div>
                  <div style={{ fontSize: '13px', fontStyle: 'italic' }}>
                    {(() => {
                      const team2Players = getPlayerNames(showScoreModal.team2);
                      return team2Players.length > 0 ? team2Players.join(', ') : 'No players';
                    })()}
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAddScore(showScoreModal._id); }}>
              <div className="form-group">
                <label>Set Number</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={scoreForm.setNumber}
                  onChange={(e) => setScoreForm({ ...scoreForm, setNumber: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>
                  {showScoreModal.team1?.name} Score
                  {(() => {
                    const team1Players = getPlayerNames(showScoreModal.team1);
                    return team1Players.length > 0 ? ` (${team1Players.join(', ')})` : '';
                  })()}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scoreForm.team1Score}
                  onChange={(e) => setScoreForm({ ...scoreForm, team1Score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>
                  {showScoreModal.team2?.name} Score
                  {(() => {
                    const team2Players = getPlayerNames(showScoreModal.team2);
                    return team2Players.length > 0 ? ` (${team2Players.join(', ')})` : '';
                  })()}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scoreForm.team2Score}
                  onChange={(e) => setScoreForm({ ...scoreForm, team2Score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowScoreModal(null);
                  setScoreForm({ setNumber: 10, team1Score: 0, team2Score: 0 });
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading.addScore}>
                  {loading.addScore ? '⏳ Adding...' : 'Add Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toss Modal with Animation */}
      {showTossModal && (
        <div className="modal" style={{ zIndex: 2000 }}>
          <style>{`
            @keyframes coinFlip {
              0% { transform: rotateY(0deg) scale(1); }
              25% { transform: rotateY(90deg) scale(1.1); }
              50% { transform: rotateY(180deg) scale(1); }
              75% { transform: rotateY(270deg) scale(1.1); }
              100% { transform: rotateY(360deg) scale(1); }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.8); }
              to { opacity: 1; transform: scale(1); }
            }
            .coin-flip {
              animation: coinFlip 0.3s infinite;
            }
            .result-bounce {
              animation: bounce 0.6s ease-in-out;
            }
            .result-fade {
              animation: fadeIn 0.5s ease-out;
            }
          `}</style>
          <div className="modal-content" style={{ 
            maxWidth: '500px', 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <div className="modal-header" style={{ borderBottom: '2px solid rgba(255,255,255,0.3)' }}>
              <h2 style={{ color: 'white', margin: 0 }}>🪙 Match Toss</h2>
              {!tossAnimating && !tossResult && (
                <span 
                  className="close" 
                  onClick={() => {
                    setShowTossModal(null);
                    setTossResult(null);
                  }}
                  style={{ color: 'white' }}
                >
                  &times;
                </span>
              )}
            </div>
            
            <div style={{ padding: '30px 20px' }}>
              {tossAnimating ? (
                <div>
                  <div 
                    className="coin-flip"
                    style={{
                      fontSize: '100px',
                      margin: '20px 0',
                      display: 'inline-block'
                    }}
                  >
                    🪙
                  </div>
                  <div style={{ fontSize: '18px', marginTop: '20px', fontWeight: 'bold' }}>
                    Flipping coin...
                  </div>
                  <div style={{ fontSize: '16px', marginTop: '15px', opacity: 0.95, fontWeight: '600' }}>
                    {showTossModal.team1?.name} vs {showTossModal.team2?.name}
                  </div>
                  {/* Show player names */}
                  <div style={{ 
                    marginTop: '20px', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '20px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    opacity: 0.85
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {showTossModal.team1?.name}:
                      </div>
                      <div style={{ fontStyle: 'italic' }}>
                        {(() => {
                          const team1Players = getPlayerNames(showTossModal.team1);
                          return team1Players.length > 0 ? team1Players.join(', ') : 'No players';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {showTossModal.team2?.name}:
                      </div>
                      <div style={{ fontStyle: 'italic' }}>
                        {(() => {
                          const team2Players = getPlayerNames(showTossModal.team2);
                          return team2Players.length > 0 ? team2Players.join(', ') : 'No players';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : tossResult ? (
                <div className="result-fade">
                  <div 
                    className="result-bounce"
                    style={{
                      fontSize: '80px',
                      margin: '20px 0'
                    }}
                  >
                    🪙
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>
                    {tossResult.winner?.name || 'Unknown'} won the toss!
                  </div>
                  
                  {/* Show teams with player names */}
                  <div style={{ 
                    marginTop: '20px',
                    display: 'flex',
                    justifyContent: 'space-around',
                    gap: '15px',
                    flexWrap: 'wrap',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      flex: 1,
                      minWidth: '150px'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                        {tossResult.team1?.name}
                      </div>
                      <div style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.9 }}>
                        {(() => {
                          const team1Players = getPlayerNames(tossResult.team1);
                          return team1Players.length > 0 ? team1Players.join(', ') : 'No players';
                        })()}
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      flex: 1,
                      minWidth: '150px'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                        {tossResult.team2?.name}
                      </div>
                      <div style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.9 }}>
                        {(() => {
                          const team2Players = getPlayerNames(tossResult.team2);
                          return team2Players.length > 0 ? team2Players.join(', ') : 'No players';
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    fontSize: '18px', 
                    marginTop: '20px',
                    padding: '15px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    fontWeight: '600'
                  }}>
                    <div style={{ fontSize: '20px' }}>
                      🏆 Toss Winner: {tossResult.winner?.name || 'Unknown'}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowTossModal(null);
                      setTossResult(null);
                    }}
                    style={{
                      marginTop: '25px',
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      background: 'white',
                      color: '#667eea',
                      border: 'none'
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <PinVerification
          onVerify={handlePinVerify}
          onCancel={handlePinCancel}
          action={
            pendingActionType === 'delete-match' ? 'delete this match' :
            pendingActionType === 'update-tournament' ? 'update tournament status' :
            'perform this action'
          }
        />
      )}

      {/* Winner Celebration Animation */}
      {showWinnerAnimation && winnerTeam && (
        <>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(50px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes bounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
            @keyframes confetti {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            .confetti-piece {
              position: absolute;
              width: 10px;
              height: 10px;
              animation: confetti 3s linear forwards;
            }
          `}</style>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              animation: 'fadeIn 0.5s ease-in'
            }}
            onClick={() => setShowWinnerAnimation(false)}
          >
            {/* Confetti Animation */}
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10px',
                  background: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'][Math.floor(Math.random() * 8)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
            
            <div 
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '40px 60px',
                borderRadius: '20px',
                textAlign: 'center',
                color: 'white',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.6s ease-out',
                position: 'relative',
                zIndex: 10001,
                maxWidth: '90%',
                minWidth: '300px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '80px', marginBottom: '20px', animation: 'bounce 1s infinite' }}>
                🏆
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '15px' }}>
                🎉 CHAMPIONS! 🎉
              </div>
              <div style={{ fontSize: '24px', marginBottom: '10px', fontWeight: '600' }}>
                {winnerTeam.name}
              </div>
              {(() => {
                const playerNames = getPlayerNames(winnerTeam);
                return playerNames.length > 0 ? (
                  <div style={{ fontSize: '16px', opacity: 0.9, marginTop: '10px', fontStyle: 'italic' }}>
                    {playerNames.join(', ')}
                  </div>
                ) : null;
              })()}
              <div style={{ 
                marginTop: '25px', 
                padding: '15px', 
                background: 'rgba(255,255,255,0.2)', 
                borderRadius: '10px',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                Tournament Winner!
              </div>
              <button
                onClick={() => setShowWinnerAnimation(false)}
                style={{
                  marginTop: '20px',
                  padding: '10px 30px',
                  fontSize: '16px',
                  background: 'rgba(255,255,255,0.3)',
                  border: '2px solid white',
                  borderRadius: '25px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.5)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TournamentDetail;

