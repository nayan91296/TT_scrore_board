import React, { useState, useEffect } from 'react';
import { getMatches, getTournaments } from '../services/api';
import { Link } from 'react-router-dom';

const MatchHistory = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTournament, setFilterTournament] = useState('');
  const [filterMatchType, setFilterMatchType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Filter is handled in render
  }, [filterTournament, filterMatchType, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matchesRes, tournamentsRes] = await Promise.all([
        getMatches(),
        getTournaments()
      ]);
      setMatches(matchesRes.data || []);
      setTournaments(tournamentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load match history');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredMatches = () => {
    let filtered = matches.filter(match => match.status === 'completed');

    // Filter by tournament
    if (filterTournament) {
      const tournamentId = filterTournament;
      filtered = filtered.filter(match => {
        const matchTournamentId = match.tournament?._id 
          ? match.tournament._id.toString() 
          : (match.tournament?.toString ? match.tournament.toString() : String(match.tournament));
        return matchTournamentId === tournamentId;
      });
    }

    // Filter by match type
    if (filterMatchType !== 'all') {
      filtered = filtered.filter(match => match.matchType === filterMatchType);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(match => {
        const team1Name = match.team1?.name || '';
        const team2Name = match.team2?.name || '';
        const winnerName = match.winner?.name || '';
        const tournamentName = match.tournament?.name || '';
        return (
          team1Name.toLowerCase().includes(searchLower) ||
          team2Name.toLowerCase().includes(searchLower) ||
          winnerName.toLowerCase().includes(searchLower) ||
          tournamentName.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.matchDate || a.createdAt);
      const dateB = new Date(b.matchDate || b.createdAt);
      return dateB - dateA;
    });
  };

  const getMatchScoreSummary = (match) => {
    if (!match.scores || !Array.isArray(match.scores) || match.scores.length === 0) {
      return 'No scores';
    }

    let team1Wins = 0;
    let team2Wins = 0;

    match.scores.forEach(score => {
      const team1Score = parseInt(score.team1Score) || 0;
      const team2Score = parseInt(score.team2Score) || 0;
      if (team1Score > team2Score) team1Wins++;
      else if (team2Score > team1Score) team2Wins++;
    });

    return `${team1Wins}-${team2Wins}`;
  };

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

  const filteredMatches = getFilteredMatches();

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <p>Loading match history...</p>
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
          📜 Match History
        </h1>
        <p style={{ 
          margin: '5px 0 0 0', 
          color: '#666', 
          fontSize: windowWidth < 480 ? '13px' : '15px' 
        }}>
          Complete history of all completed matches with detailed scores
        </p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              🔍 Search
            </label>
            <input
              type="text"
              placeholder="Search teams, players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              🏆 Tournament
            </label>
            <select
              value={filterTournament}
              onChange={(e) => setFilterTournament(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="">All Tournaments</option>
              {tournaments.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              🎯 Match Type
            </label>
            <select
              value={filterMatchType}
              onChange={(e) => setFilterMatchType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="all">All Types</option>
              <option value="group">Group</option>
              <option value="quarterfinal">Quarterfinal</option>
              <option value="semifinal">Semi-Final</option>
              <option value="final">Final</option>
            </select>
          </div>
          {(filterTournament || filterMatchType !== 'all' || searchTerm) && (
            <div>
              <button
                onClick={() => {
                  setFilterTournament('');
                  setFilterMatchType('all');
                  setSearchTerm('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
        {filteredMatches.length > 0 && (
          <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            Showing {filteredMatches.length} of {matches.filter(m => m.status === 'completed').length} completed matches
          </div>
        )}
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
          <p style={{ fontSize: '16px', color: '#666' }}>
            {searchTerm || filterTournament || filterMatchType !== 'all'
              ? 'No matches found matching your filters'
              : 'No completed matches yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {filteredMatches.map((match) => {
            const team1Name = match.team1?.name || 'Team 1';
            const team2Name = match.team2?.name || 'Team 2';
            const winnerName = match.winner?.name || 'Unknown';
            const matchDate = match.matchDate 
              ? new Date(match.matchDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : new Date(match.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric'
                });
            const tournamentName = match.tournament?.name || 'Unknown Tournament';
            const tournamentId = match.tournament?._id || match.tournament;
            const team1Players = getPlayerNames(match.team1);
            const team2Players = getPlayerNames(match.team2);
            const isTeam1Winner = match.winner && (
              (match.winner._id ? match.winner._id.toString() : match.winner.toString()) ===
              (match.team1?._id ? match.team1._id.toString() : match.team1?.toString())
            );
            const isTeam2Winner = match.winner && (
              (match.winner._id ? match.winner._id.toString() : match.winner.toString()) ===
              (match.team2?._id ? match.team2._id.toString() : match.team2?.toString())
            );

            return (
              <div 
                key={match._id}
                className="card"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${
                    match.matchType === 'final' ? '#ff9800' :
                    match.matchType === 'semifinal' ? '#2196f3' :
                    match.matchType === 'quarterfinal' ? '#9c27b0' :
                    '#4caf50'
                  }`
                }}
              >
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '15px',
                  marginBottom: '15px'
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        background: match.matchType === 'final' ? '#fff3e0' :
                                   match.matchType === 'semifinal' ? '#e3f2fd' :
                                   match.matchType === 'quarterfinal' ? '#f3e5f5' :
                                   '#e8f5e9',
                        color: match.matchType === 'final' ? '#ff9800' :
                               match.matchType === 'semifinal' ? '#2196f3' :
                               match.matchType === 'quarterfinal' ? '#9c27b0' :
                               '#4caf50'
                      }}>
                        {match.matchType || 'group'}
                      </span>
                      {tournamentId && (
                        <Link
                          to={`/tournaments/${tournamentId}`}
                          style={{
                            fontSize: '13px',
                            color: '#1976d2',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                        >
                          {tournamentName}
                        </Link>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      📅 {matchDate}
                    </div>
                  </div>
                </div>

                {/* Teams */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr auto 1fr',
                  gap: '15px',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  {/* Team 1 */}
                  <div style={{
                    padding: '15px',
                    background: isTeam1Winner ? '#e8f5e9' : '#f8f9fa',
                    borderRadius: '8px',
                    border: isTeam1Winner ? '2px solid #4caf50' : '1px solid #ddd'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      fontSize: '16px',
                      marginBottom: '5px',
                      color: isTeam1Winner ? '#4caf50' : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {isTeam1Winner && '🏆 '}
                      {team1Name}
                    </div>
                    {team1Players && (
                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        {team1Players}
                      </div>
                    )}
                  </div>

                  {/* VS */}
                  <div style={{ 
                    textAlign: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#666'
                  }}>
                    VS
                  </div>

                  {/* Team 2 */}
                  <div style={{
                    padding: '15px',
                    background: isTeam2Winner ? '#e8f5e9' : '#f8f9fa',
                    borderRadius: '8px',
                    border: isTeam2Winner ? '2px solid #4caf50' : '1px solid #ddd'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      fontSize: '16px',
                      marginBottom: '5px',
                      color: isTeam2Winner ? '#4caf50' : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {isTeam2Winner && '🏆 '}
                      {team2Name}
                    </div>
                    {team2Players && (
                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        {team2Players}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scores */}
                {match.scores && match.scores.length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    marginTop: '10px'
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      marginBottom: '8px',
                      color: '#666'
                    }}>
                      Set Scores: {getMatchScoreSummary(match)}
                    </div>
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: windowWidth < 480 ? '1fr' : 'repeat(auto-fit, minmax(80px, 1fr))',
                      gap: '8px'
                    }}>
                      {match.scores.map((score, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '8px',
                            background: 'white',
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            Set {score.setNumber || idx + 1}
                          </div>
                          <div style={{ 
                            color: parseInt(score.team1Score || 0) > parseInt(score.team2Score || 0) ? '#4caf50' : '#666',
                            fontWeight: 'bold'
                          }}>
                            {score.team1Score || 0}
                          </div>
                          <div style={{ color: '#999', margin: '2px 0' }}>-</div>
                          <div style={{ 
                            color: parseInt(score.team2Score || 0) > parseInt(score.team1Score || 0) ? '#4caf50' : '#666',
                            fontWeight: 'bold'
                          }}>
                            {score.team2Score || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Winner */}
                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  background: '#e8f5e9',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#4caf50',
                    marginBottom: '4px'
                  }}>
                    🏆 Winner: {winnerName}
                  </div>
                  {(() => {
                    const winnerPlayers = getPlayerNames(match.winner);
                    return winnerPlayers && winnerPlayers.length > 0 ? (
                      <div style={{ 
                        fontSize: '12px',
                        color: '#666',
                        fontStyle: 'italic',
                        marginTop: '4px'
                      }}>
                        {winnerPlayers}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchHistory;

