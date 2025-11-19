import React, { useState, useEffect } from 'react';
import { getPlayers, getTournaments, getMatches, getTeams } from '../services/api';

const StatisticsDashboard = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStatistics();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const [playersRes, tournamentsRes, matchesRes, teamsRes] = await Promise.all([
        getPlayers(),
        getTournaments(),
        getMatches(),
        getTeams()
      ]);

      const players = playersRes.data || [];
      const tournaments = tournamentsRes.data || [];
      const matches = matchesRes.data || [];
      const teams = teamsRes.data || [];

      // Calculate statistics
      const completedTournaments = tournaments.filter(t => t.status === 'completed');
      const completedMatches = matches.filter(m => m.status === 'completed');
      const activePlayers = players.filter(p => (p.totalMatches || 0) > 0);

      // Top performers
      const topPlayers = [...players]
        .filter(p => (p.totalMatches || 0) > 0)
        .sort((a, b) => {
          const scoreA = calculatePerformanceScore(a);
          const scoreB = calculatePerformanceScore(b);
          return scoreB - scoreA;
        })
        .slice(0, 5);

      // Most active players
      const mostActivePlayers = [...players]
        .filter(p => (p.totalMatches || 0) > 0)
        .sort((a, b) => (b.totalMatches || 0) - (a.totalMatches || 0))
        .slice(0, 5);

      // Helper function to get player names from a team
      const getPlayerNames = (team) => {
        if (!team || !team.players) return '';
        if (!Array.isArray(team.players)) return '';
        
        const names = team.players
          .map(p => {
            if (p && typeof p === 'object' && p.name) {
              return p.name;
            }
            if (typeof p === 'string' && !/^[0-9a-fA-F]{24}$/.test(p)) {
              return p;
            }
            return null;
          })
          .filter(name => name !== null && name !== undefined && name !== '');
        
        return names.join(', ');
      };

      // Tournament winners
      const tournamentWinners = completedTournaments
        .filter(t => t.winner)
        .map(t => {
          const winner = t.winner;
          const playerNames = getPlayerNames(winner);
          return {
            tournament: t.name,
            winner: winner.name || 'Unknown',
            playerNames: playerNames,
            date: new Date(t.endDate).toLocaleDateString()
          };
        })
        .slice(0, 5);

      // Recent matches
      const recentMatches = [...completedMatches]
        .sort((a, b) => new Date(b.matchDate || b.createdAt) - new Date(a.matchDate || a.createdAt))
        .slice(0, 5);

      // Calculate win percentages
      const totalMatches = completedMatches.length;
      const totalWins = players.reduce((sum, p) => sum + (p.matchesWon || 0), 0);
      const totalLosses = players.reduce((sum, p) => sum + (p.matchesLost || 0), 0);
      const overallWinPercentage = totalMatches > 0 
        ? parseFloat(((totalWins / (totalWins + totalLosses)) * 100).toFixed(1))
        : 0;

      setStats({
        totalPlayers: players.length,
        activePlayers: activePlayers.length,
        totalTournaments: tournaments.length,
        completedTournaments: completedTournaments.length,
        totalMatches,
        totalWins,
        totalLosses,
        overallWinPercentage,
        totalTeams: teams.length,
        topPlayers,
        mostActivePlayers,
        tournamentWinners,
        recentMatches
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
      alert('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformanceScore = (player) => {
    const matchesWon = player.matchesWon || 0;
    const matchesLost = player.matchesLost || 0;
    const totalMatches = matchesWon + matchesLost;
    const winPercentage = totalMatches > 0 ? (matchesWon / totalMatches) * 100 : 0;
    const tournamentsWon = player.tournamentsWon || 0;
    const finalMatches = player.finalMatches || 0;
    const semiFinalMatches = player.semiFinalMatches || 0;
    
    const score = 
      (winPercentage * 0.4) +
      (Math.min(totalMatches / 50, 1) * 100 * 0.2) +
      (tournamentsWon * 10 * 0.2) +
      (finalMatches * 5 * 0.1) +
      (semiFinalMatches * 2 * 0.1);
    
    return score;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No statistics available</p>
      </div>
    );
  }

  return (
    <div style={{ padding: windowWidth < 768 ? '15px' : '20px' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '30px',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '20px'
      }}>
        <h1 style={{ 
          margin: '0 0 10px 0', 
          fontSize: windowWidth < 768 ? '28px' : '36px',
          color: '#1976d2',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          📊 Statistics Dashboard
        </h1>
        <p style={{ 
          margin: '5px 0 0 0', 
          color: '#666', 
          fontSize: windowWidth < 480 ? '13px' : '15px' 
        }}>
          Comprehensive overview of tournament statistics and performance metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: windowWidth < 768 ? '1fr' : windowWidth < 1200 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{ 
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '5px' }}>
            {stats.totalPlayers}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Players</div>
        </div>
        <div style={{ 
          padding: '20px',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '5px' }}>
            {stats.completedTournaments}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Tournaments</div>
        </div>
        <div style={{ 
          padding: '20px',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '5px' }}>
            {stats.totalMatches}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Matches</div>
        </div>
        <div style={{ 
          padding: '20px',
          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '5px' }}>
            {stats.overallWinPercentage}%
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Overall Win %</div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1976d2' }}>
          🏆 Top 5 Performers
        </h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {stats.topPlayers.map((player, index) => (
            <div 
              key={player._id}
              style={{
                padding: '15px',
                background: index === 0 ? '#fff9e6' : index === 1 ? '#f5f5f5' : index === 2 ? '#fff4e6' : '#f8f9fa',
                borderRadius: '8px',
                borderLeft: `4px solid ${index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#666'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                </span>
                <strong style={{ fontSize: '16px' }}>{player.name}</strong>
              </div>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: '#666' }}>
                <span>Win %: <strong style={{ color: '#4caf50' }}>{player.winPercentage || 0}%</strong></span>
                <span>Matches: <strong>{player.totalMatches || 0}</strong></span>
                <span>🏆: <strong style={{ color: '#ff9800' }}>{player.tournamentsWon || 0}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Most Active Players */}
        <div className="card" style={{ padding: '20px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1976d2' }}>
            🎮 Most Active Players
          </h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {stats.mostActivePlayers.map((player, index) => (
              <div 
                key={player._id}
                style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#666' }}>{index + 1}.</span>
                  <strong>{player.name}</strong>
                </div>
                <span style={{ color: '#2196f3', fontWeight: 'bold' }}>
                  {player.totalMatches || 0} matches
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tournament Winners */}
        <div className="card" style={{ padding: '20px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1976d2' }}>
            🏆 Recent Tournament Winners
          </h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {stats.tournamentWinners.length > 0 ? (
              stats.tournamentWinners.map((item, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    borderLeft: '3px solid #ff9800'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.tournament}</div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    🏆 {item.winner}
                  </div>
                  {item.playerNames && item.playerNames.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic', marginBottom: '4px' }}>
                      {item.playerNames}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {item.date}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No completed tournaments yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      <div className="card" style={{ padding: '20px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1976d2' }}>
          📅 Recent Matches
        </h2>
        {stats.recentMatches.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {stats.recentMatches.map((match) => {
              const team1Name = match.team1?.name || 'Team 1';
              const team2Name = match.team2?.name || 'Team 2';
              const winnerName = match.winner?.name || 'Unknown';
              const matchDate = match.matchDate 
                ? new Date(match.matchDate).toLocaleDateString()
                : new Date(match.createdAt).toLocaleDateString();
              
              // Helper function to get player names
              const getPlayerNames = (team) => {
                if (!team || !team.players) return '';
                if (!Array.isArray(team.players)) return '';
                
                const names = team.players
                  .map(p => {
                    if (p && typeof p === 'object' && p.name) {
                      return p.name;
                    }
                    if (typeof p === 'string' && !/^[0-9a-fA-F]{24}$/.test(p)) {
                      return p;
                    }
                    return null;
                  })
                  .filter(name => name !== null && name !== undefined && name !== '');
                
                return names.join(', ');
              };
              
              const team1Players = getPlayerNames(match.team1);
              const team2Players = getPlayerNames(match.team2);
              const winnerPlayers = getPlayerNames(match.winner);
              
              return (
                <div 
                  key={match._id}
                  style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {team1Name} vs {team2Name}
                      </div>
                      {(team1Players || team2Players) && (
                        <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic', marginBottom: '4px' }}>
                          {team1Players && team1Players.length > 0 && (
                            <span>{team1Name}: {team1Players}</span>
                          )}
                          {team1Players && team1Players.length > 0 && team2Players && team2Players.length > 0 && ' • '}
                          {team2Players && team2Players.length > 0 && (
                            <span>{team2Name}: {team2Players}</span>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {match.matchType} • {matchDate}
                      </div>
                    </div>
                    <div style={{ 
                      padding: '6px 12px',
                      background: '#e8f5e9',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#4caf50',
                      textAlign: 'center'
                    }}>
                      <div>🏆 {winnerName}</div>
                      {winnerPlayers && winnerPlayers.length > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '2px', fontStyle: 'italic' }}>
                          {winnerPlayers}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No completed matches yet
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsDashboard;

