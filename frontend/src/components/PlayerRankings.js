import React, { useState, useEffect } from 'react';
import { getPlayers } from '../services/api';

const PlayerRankings = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('overall');
  const [selectedFormat, setSelectedFormat] = useState('all'); // all, recent, tournaments
  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  useEffect(() => {
    loadPlayers();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedMonth]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const response = await getPlayers(selectedMonth);
      setPlayers(response.data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      alert('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  // Calculate performance score (similar to what's used in PlayersAndTeams)
  const calculatePerformanceScore = (player) => {
    const matchesWon = player.matchesWon || 0;
    const matchesLost = player.matchesLost || 0;
    const totalMatches = matchesWon + matchesLost;
    const winPercentage = totalMatches > 0 ? (matchesWon / totalMatches) * 100 : 0;
    const tournamentsWon = player.tournamentsWon || 0;
    const finalMatches = player.finalMatches || 0;
    const semiFinalMatches = player.semiFinalMatches || 0;
    
    // Composite scoring: win% (40%), total matches (20%), tournaments won (20%), finals (10%), semis (10%)
    const score = 
      (winPercentage * 0.4) +
      (Math.min(totalMatches / 50, 1) * 100 * 0.2) +
      (tournamentsWon * 10 * 0.2) +
      (finalMatches * 5 * 0.1) +
      (semiFinalMatches * 2 * 0.1);
    
    return score;
  };

  // Get rankings based on selected category
  const getRankings = () => {
    let sorted = [...players];

    switch (selectedCategory) {
      case 'overall':
        sorted.sort((a, b) => {
          const scoreA = calculatePerformanceScore(a);
          const scoreB = calculatePerformanceScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
          // Tie-breaker: more matches
          return (b.totalMatches || 0) - (a.totalMatches || 0);
        });
        break;
      
      case 'winPercentage':
        sorted = sorted.filter(p => (p.totalMatches || 0) > 0);
        sorted.sort((a, b) => {
          const winPctA = a.winPercentage || 0;
          const winPctB = b.winPercentage || 0;
          if (winPctB !== winPctA) return winPctB - winPctA;
          // Tie-breaker: more matches
          return (b.totalMatches || 0) - (a.totalMatches || 0);
        });
        break;
      
      case 'matchesWon':
        sorted.sort((a, b) => {
          const wonA = a.matchesWon || 0;
          const wonB = b.matchesWon || 0;
          if (wonB !== wonA) return wonB - wonA;
          // Tie-breaker: win percentage
          return (b.winPercentage || 0) - (a.winPercentage || 0);
        });
        break;
      
      case 'tournamentsWon':
        sorted.sort((a, b) => {
          const trophiesA = a.tournamentsWon || 0;
          const trophiesB = b.tournamentsWon || 0;
          if (trophiesB !== trophiesA) return trophiesB - trophiesA;
          // Tie-breaker: finals reached
          return (b.finalMatches || 0) - (a.finalMatches || 0);
        });
        break;
      
      case 'finals':
        sorted.sort((a, b) => {
          const finalsA = a.finalMatches || 0;
          const finalsB = b.finalMatches || 0;
          if (finalsB !== finalsA) return finalsB - finalsA;
          // Tie-breaker: tournaments won
          return (b.tournamentsWon || 0) - (a.tournamentsWon || 0);
        });
        break;
      
      case 'totalMatches':
        sorted.sort((a, b) => {
          const totalA = a.totalMatches || 0;
          const totalB = b.totalMatches || 0;
          if (totalB !== totalA) return totalB - totalA;
          // Tie-breaker: win percentage
          return (b.winPercentage || 0) - (a.winPercentage || 0);
        });
        break;
      
      default:
        break;
    }

    return sorted;
  };

  const rankings = getRankings();

  const getRankBadge = (rank) => {
    if (rank === 1) return { emoji: '🥇', color: '#FFD700', bg: '#FFF9E6' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0', bg: '#F5F5F5' };
    if (rank === 3) return { emoji: '🥉', color: '#CD7F32', bg: '#FFF4E6' };
    return { emoji: null, color: '#666', bg: 'transparent' };
  };

  const getCategoryTitle = () => {
    const titles = {
      overall: 'Overall Performance',
      winPercentage: 'Win Percentage',
      matchesWon: 'Most Matches Won',
      tournamentsWon: 'Tournaments Won',
      finals: 'Finals Reached',
      totalMatches: 'Total Matches Played'
    };
    return titles[selectedCategory] || 'Rankings';
  };

  const getCategoryDescription = () => {
    const descriptions = {
      overall: 'Combined ranking based on win percentage, matches played, tournaments won, and finals reached',
      winPercentage: 'Ranked by highest win percentage (minimum 1 match required)',
      matchesWon: 'Ranked by total number of matches won',
      tournamentsWon: 'Ranked by number of tournaments won',
      finals: 'Ranked by number of finals reached',
      totalMatches: 'Ranked by total matches played'
    };
    return descriptions[selectedCategory] || '';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <p>Loading rankings...</p>
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
          🏆 Player Rankings
        </h1>
        <p style={{ 
          margin: '5px 0 0 0', 
          color: '#666', 
          fontSize: windowWidth < 480 ? '13px' : '15px' 
        }}>
          Official player rankings based on tournament performance
        </p>
      </div>

      {/* Month Filter */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        flexWrap: 'wrap'
      }}>
        <div style={{ minWidth: '200px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '5px', 
            fontWeight: 'bold', 
            fontSize: '14px',
            color: '#1976d2'
          }}>
            📅 Filter by Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '2px solid #1976d2',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ 
        marginBottom: '25px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '10px'
      }}>
        {[
          { id: 'overall', label: 'Overall', icon: '⭐' },
          { id: 'winPercentage', label: 'Win %', icon: '📊' },
          { id: 'matchesWon', label: 'Wins', icon: '✅' },
          { id: 'tournamentsWon', label: 'Trophies', icon: '🏆' },
          { id: 'finals', label: 'Finals', icon: '🎯' },
          { id: 'totalMatches', label: 'Matches', icon: '🎮' }
        ].map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            style={{
              padding: windowWidth < 480 ? '8px 12px' : '10px 18px',
              fontSize: windowWidth < 480 ? '12px' : '14px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: selectedCategory === category.id ? '#1976d2' : '#f5f5f5',
              color: selectedCategory === category.id ? 'white' : '#666',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (selectedCategory !== category.id) {
                e.target.style.backgroundColor = '#e0e0e0';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== category.id) {
                e.target.style.backgroundColor = '#f5f5f5';
              }
            }}
          >
            <span>{category.icon}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>

      {/* Category Info */}
      <div style={{ 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        borderLeft: '4px solid #1976d2'
      }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#1976d2' }}>
          {getCategoryTitle()}
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          {getCategoryDescription()}
        </p>
      </div>

      {/* Rankings Table */}
      {rankings.length === 0 ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
          <p style={{ fontSize: '16px', color: '#666' }}>No players found</p>
        </div>
      ) : (
        <div className="card" style={{ padding: windowWidth < 768 ? '15px' : '20px', overflowX: 'auto' }}>
          <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table" style={{ 
              minWidth: windowWidth < 768 ? '800px' : '100%', 
              fontSize: windowWidth < 480 ? '12px' : '14px',
              margin: 0
            }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ 
                    width: '60px', 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Rank
                  </th>
                  <th style={{ 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Player
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Matches
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Won
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Lost
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Win %
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Finals
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    🏆
                  </th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '12px 8px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Tournaments
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((player, index) => {
                  const rank = index + 1;
                  const badge = getRankBadge(rank);
                  const matchesWon = player.matchesWon || 0;
                  const matchesLost = player.matchesLost || 0;
                  const totalMatches = player.totalMatches || matchesWon + matchesLost;
                  const winPercentage = player.winPercentage || (totalMatches > 0 ? parseFloat(((matchesWon / totalMatches) * 100).toFixed(1)) : 0);
                  const tournamentsWon = player.tournamentsWon || 0;
                  const finalMatches = player.finalMatches || 0;
                  
                  return (
                    <tr 
                      key={player._id}
                      style={{
                        backgroundColor: rank <= 3 ? badge.bg : (index % 2 === 0 ? 'white' : '#f8f9fa'),
                        borderLeft: rank <= 3 ? `4px solid ${badge.color}` : 'none',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (rank > 3) {
                          e.currentTarget.style.backgroundColor = '#e8f4f8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (rank > 3) {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f8f9fa';
                        }
                      }}
                    >
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        fontSize: windowWidth < 480 ? '16px' : '18px'
                      }}>
                        {badge.emoji || (
                          <span style={{ color: '#666' }}>{rank}</span>
                        )}
                      </td>
                      <td style={{ padding: '15px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <strong style={{ 
                            fontSize: windowWidth < 480 ? '14px' : '16px',
                            color: rank <= 3 ? badge.color : '#333'
                          }}>
                            {player.name}
                          </strong>
                          {rank <= 3 && (
                            <span style={{ 
                              fontSize: '18px',
                              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))'
                            }}>
                              ⭐
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: '#2196f3'
                      }}>
                        {totalMatches}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: '#4caf50'
                      }}>
                        {matchesWon}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: '#f44336'
                      }}>
                        {matchesLost}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: winPercentage >= 70 ? '#4caf50' : winPercentage >= 50 ? '#8bc34a' : winPercentage > 0 ? '#ff9800' : '#666',
                        fontSize: windowWidth < 480 ? '13px' : '14px'
                      }}>
                        {winPercentage}%
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: '#ff9800'
                      }}>
                        {finalMatches}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: tournamentsWon > 0 ? '#ff9800' : '#666',
                        fontSize: windowWidth < 480 ? '16px' : '18px'
                      }}>
                        {tournamentsWon}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '15px 8px',
                        fontWeight: 'bold',
                        color: '#673ab7'
                      }}>
                        {player.tournamentsPlayed || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div style={{ 
        marginTop: '30px',
        display: 'grid',
        gridTemplateColumns: windowWidth < 768 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px'
      }}>
        <div style={{ 
          padding: '20px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1976d2' }}>
            {rankings.length}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Total Players
          </div>
        </div>
        <div style={{ 
          padding: '20px',
          backgroundColor: '#f3e5f5',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9c27b0' }}>
            {rankings.filter(p => (p.totalMatches || 0) > 0).length}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Active Players
          </div>
        </div>
        <div style={{ 
          padding: '20px',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
            {rankings.reduce((sum, p) => sum + (p.totalMatches || 0), 0)}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Total Matches
          </div>
        </div>
        <div style={{ 
          padding: '20px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff9800' }}>
            {rankings.reduce((sum, p) => sum + (p.tournamentsWon || 0), 0)}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Total Trophies
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerRankings;

