import React, { useState, useEffect } from 'react';
import { getPlayers, getMatches } from '../services/api';

const PlayerHeadToHead = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState('');
  const [selectedPlayer2, setSelectedPlayer2] = useState('');
  const [h2hData, setH2hData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedPlayer1 && selectedPlayer2 && selectedPlayer1 !== selectedPlayer2) {
      calculateHeadToHead();
    } else {
      setH2hData(null);
    }
  }, [selectedPlayer1, selectedPlayer2, matches]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersRes, matchesRes] = await Promise.all([
        getPlayers(),
        getMatches()
      ]);
      setPlayers(playersRes.data || []);
      setMatches(matchesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateHeadToHead = () => {
    if (!selectedPlayer1 || !selectedPlayer2 || selectedPlayer1 === selectedPlayer2) {
      setH2hData(null);
      return;
    }

    const player1 = players.find(p => p._id === selectedPlayer1);
    const player2 = players.find(p => p._id === selectedPlayer2);

    if (!player1 || !player2) {
      setH2hData(null);
      return;
    }

    // Find all completed matches where both players played together or against each other
    const relevantMatches = matches.filter(match => {
      if (match.status !== 'completed' || !match.team1 || !match.team2 || !match.winner) {
        return false;
      }

      const team1Players = match.team1.players || [];
      const team2Players = match.team2.players || [];

      const team1PlayerIds = team1Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });
      const team2PlayerIds = team2Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });

      const player1Id = player1._id.toString();
      const player2Id = player2._id.toString();

      // Check if both players are in the same team (playing together)
      const playingTogether = 
        (team1PlayerIds.includes(player1Id) && team1PlayerIds.includes(player2Id)) ||
        (team2PlayerIds.includes(player1Id) && team2PlayerIds.includes(player2Id));

      // Check if players are on opposite teams (playing against each other)
      const playingAgainst = 
        (team1PlayerIds.includes(player1Id) && team2PlayerIds.includes(player2Id)) ||
        (team1PlayerIds.includes(player2Id) && team2PlayerIds.includes(player1Id));

      return playingTogether || playingAgainst;
    });

    // Separate matches where they played together vs against each other
    const togetherMatches = [];
    const againstMatches = [];

    relevantMatches.forEach(match => {
      const team1Players = match.team1.players || [];
      const team2Players = match.team2.players || [];

      const team1PlayerIds = team1Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });
      const team2PlayerIds = team2Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });

      const player1Id = player1._id.toString();
      const player2Id = player2._id.toString();

      const sameTeam = 
        (team1PlayerIds.includes(player1Id) && team1PlayerIds.includes(player2Id)) ||
        (team2PlayerIds.includes(player1Id) && team2PlayerIds.includes(player2Id));

      if (sameTeam) {
        togetherMatches.push(match);
      } else {
        againstMatches.push(match);
      }
    });

    // Calculate stats for playing together
    let togetherWins = 0;
    let togetherLosses = 0;
    const player1IdStr = player1._id.toString();
    const player2IdStr = player2._id.toString();
    
    togetherMatches.forEach(match => {
      const winnerId = match.winner?._id ? match.winner._id.toString() : match.winner?.toString();
      const team1Id = match.team1?._id ? match.team1._id.toString() : match.team1?.toString();
      const team2Id = match.team2?._id ? match.team2._id.toString() : match.team2?.toString();

      const team1Players = match.team1.players || [];
      const team1PlayerIds = team1Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });

      if (team1PlayerIds.includes(player1IdStr) && team1PlayerIds.includes(player2IdStr)) {
        if (winnerId === team1Id) togetherWins++;
        else togetherLosses++;
      } else {
        if (winnerId === team2Id) togetherWins++;
        else togetherLosses++;
      }
    });

    // Calculate stats for playing against each other
    let player1Wins = 0;
    let player2Wins = 0;
    againstMatches.forEach(match => {
      const winnerId = match.winner?._id ? match.winner._id.toString() : match.winner?.toString();
      const team1Id = match.team1?._id ? match.team1._id.toString() : match.team1?.toString();
      const team2Id = match.team2?._id ? match.team2._id.toString() : match.team2?.toString();

      const team1Players = match.team1.players || [];
      const team1PlayerIds = team1Players.map(p => {
        const id = p._id || p;
        return id.toString ? id.toString() : String(id);
      });

      if (team1PlayerIds.includes(player1IdStr)) {
        if (winnerId === team1Id) player1Wins++;
        else player2Wins++;
      } else {
        if (winnerId === team2Id) player1Wins++;
        else player2Wins++;
      }
    });

    setH2hData({
      player1,
      player2,
      togetherMatches: togetherMatches.length,
      togetherWins,
      togetherLosses,
      togetherWinPercentage: togetherMatches.length > 0 
        ? parseFloat(((togetherWins / togetherMatches.length) * 100).toFixed(1))
        : 0,
      againstMatches: againstMatches.length,
      player1Wins,
      player2Wins,
      player1WinPercentage: againstMatches.length > 0
        ? parseFloat(((player1Wins / againstMatches.length) * 100).toFixed(1))
        : 0,
      player2WinPercentage: againstMatches.length > 0
        ? parseFloat(((player2Wins / againstMatches.length) * 100).toFixed(1))
        : 0,
      allMatches: relevantMatches
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <p>Loading...</p>
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
          ⚔️ Player vs Player
        </h1>
        <p style={{ 
          margin: '5px 0 0 0', 
          color: '#666', 
          fontSize: windowWidth < 480 ? '13px' : '15px' 
        }}>
          Compare head-to-head statistics between two players
        </p>
      </div>

      {/* Player Selection */}
      <div className="card" style={{ marginBottom: '25px', padding: '20px' }}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr auto 1fr',
          gap: '20px',
          alignItems: 'center'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Select Player 1
            </label>
            <select
              value={selectedPlayer1}
              onChange={(e) => setSelectedPlayer1(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="">Choose Player 1...</option>
              {players.map(player => (
                <option key={player._id} value={player._id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ 
            textAlign: 'center',
            fontSize: '24px',
            color: '#666',
            display: windowWidth < 768 ? 'none' : 'block'
          }}>
            VS
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Select Player 2
            </label>
            <select
              value={selectedPlayer2}
              onChange={(e) => setSelectedPlayer2(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="">Choose Player 2...</option>
              {players.map(player => (
                <option key={player._id} value={player._id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPlayer1 && selectedPlayer2 && selectedPlayer1 === selectedPlayer2 && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#fff3cd',
            borderRadius: '5px',
            color: '#856404',
            textAlign: 'center'
          }}>
            ⚠️ Please select two different players
          </div>
        )}
      </div>

      {/* Head-to-Head Results */}
      {h2hData && (
        <div>
          {/* Playing Together Stats */}
          {h2hData.togetherMatches > 0 && (
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
              <h2 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '20px',
                color: '#1976d2',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🤝 Playing Together
              </h2>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: windowWidth < 480 ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '15px',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  padding: '15px',
                  background: '#e3f2fd',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Matches</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2' }}>
                    {h2hData.togetherMatches}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px',
                  background: '#e8f5e9',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Wins</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
                    {h2hData.togetherWins}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px',
                  background: '#ffebee',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Losses</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f44336' }}>
                    {h2hData.togetherLosses}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px',
                  background: '#fff3e0',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Win %</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff9800' }}>
                    {h2hData.togetherWinPercentage}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Playing Against Each Other Stats */}
          {h2hData.againstMatches > 0 && (
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
              <h2 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '20px',
                color: '#1976d2',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                ⚔️ Head-to-Head (Playing Against)
              </h2>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr',
                gap: '20px',
                marginBottom: '20px'
              }}>
                {/* Player 1 Stats */}
                <div style={{ 
                  padding: '20px',
                  background: '#e3f2fd',
                  borderRadius: '8px',
                  border: '2px solid #1976d2'
                }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    marginBottom: '15px',
                    color: '#1976d2',
                    textAlign: 'center'
                  }}>
                    {h2hData.player1.name}
                  </div>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Wins</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                        {h2hData.player1Wins}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Win %</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                        {h2hData.player1WinPercentage}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Player 2 Stats */}
                <div style={{ 
                  padding: '20px',
                  background: '#f3e5f5',
                  borderRadius: '8px',
                  border: '2px solid #9c27b0'
                }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    marginBottom: '15px',
                    color: '#9c27b0',
                    textAlign: 'center'
                  }}>
                    {h2hData.player2.name}
                  </div>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Wins</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                        {h2hData.player2Wins}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Win %</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                        {h2hData.player2WinPercentage}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Head-to-Head Summary */}
              <div style={{ 
                padding: '15px',
                background: '#f5f5f5',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Matches</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                  {h2hData.againstMatches}
                </div>
                {h2hData.player1Wins > h2hData.player2Wins && (
                  <div style={{ marginTop: '10px', fontSize: '16px', color: '#1976d2', fontWeight: 'bold' }}>
                    🏆 {h2hData.player1.name} leads {h2hData.player1Wins}-{h2hData.player2Wins}
                  </div>
                )}
                {h2hData.player2Wins > h2hData.player1Wins && (
                  <div style={{ marginTop: '10px', fontSize: '16px', color: '#9c27b0', fontWeight: 'bold' }}>
                    🏆 {h2hData.player2.name} leads {h2hData.player2Wins}-{h2hData.player1Wins}
                  </div>
                )}
                {h2hData.player1Wins === h2hData.player2Wins && h2hData.againstMatches > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '16px', color: '#ff9800', fontWeight: 'bold' }}>
                    ⚖️ Tied {h2hData.player1Wins}-{h2hData.player2Wins}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Data Message */}
          {h2hData.togetherMatches === 0 && h2hData.againstMatches === 0 && (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
              <p style={{ fontSize: '16px', color: '#666' }}>
                No matches found between {h2hData.player1.name} and {h2hData.player2.name}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!h2hData && (!selectedPlayer1 || !selectedPlayer2 || selectedPlayer1 === selectedPlayer2) && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚔️</div>
          <p style={{ fontSize: '16px', color: '#666' }}>
            Select two players to compare their head-to-head statistics
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerHeadToHead;

