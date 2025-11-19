import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, getTournamentHistory, createTournament, deleteTournament } from '../services/api';
import PinVerification from './PinVerification';

const Tournaments = () => {
  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [tournaments, setTournaments] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'history'
  const [showModal, setShowModal] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [formData, setFormData] = useState({
    name: '',
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    description: '',
    status: 'upcoming'
  });
  
  // PIN verification state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadAllTournaments();
  }, []);

  // Load all tournaments on mount to get accurate counts
  const loadAllTournaments = async () => {
    try {
      const response = await getTournaments();
      setTournaments(response.data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      alert('Failed to load tournaments');
    }
  };

  // Reload tournaments after create/delete
  const loadTournaments = async () => {
    await loadAllTournaments();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure dates are properly formatted
      const tournamentData = {
        ...formData,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate)
      };
      await createTournament(tournamentData);
      setShowModal(false);
      setFormData({ name: '', startDate: getTodayDate(), endDate: getTodayDate(), description: '', status: 'upcoming' });
      loadTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create tournament';
      alert(`Failed to create tournament: ${errorMessage}`);
    }
  };

  const handleDelete = (id) => {
    setPendingAction(() => async () => {
      try {
        await deleteTournament(id);
        loadTournaments();
      } catch (error) {
        console.error('Error deleting tournament:', error);
        alert('Failed to delete tournament');
      }
    });
    setPendingActionType('delete');
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

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: 'badge-secondary',
      ongoing: 'badge-info',
      completed: 'badge-success'
    };
    return <span className={`badge ${badges[status]}`}>{status}</span>;
  };

  // Filter tournaments based on active tab
  const getFilteredTournaments = () => {
    if (activeTab === 'all') {
      return tournaments;
    } else if (activeTab === 'active') {
      const active = tournaments.filter(t => t.status === 'upcoming' || t.status === 'ongoing');
      // Sort active tournaments by start date
      return active.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else if (activeTab === 'history') {
      const history = tournaments.filter(t => t.status === 'completed');
      // Sort history by end date (most recent first)
      return history.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
    }
    return tournaments;
  };

  const filteredTournaments = getFilteredTournaments();
  
  // Calculate counts for tabs
  const allCount = tournaments.length;
  const activeCount = tournaments.filter(t => t.status === 'upcoming' || t.status === 'ongoing').length;
  const historyCount = tournaments.filter(t => t.status === 'completed').length;

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0, fontSize: windowWidth < 768 ? '24px' : '32px' }}>Tournaments</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: windowWidth < 480 ? '14px' : '16px', padding: windowWidth < 480 ? '8px 16px' : '10px 20px' }}>
          + Add Tournament
        </button>
      </div>

      {/* Tabs for filtering tournaments */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #dee2e6' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('all')}
            style={{
              borderBottom: activeTab === 'all' ? '3px solid #007bff' : 'none',
              borderRadius: '4px 4px 0 0',
              marginBottom: '-2px'
            }}
          >
            All Tournaments ({allCount})
          </button>
          <button
            className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('active')}
            style={{
              borderBottom: activeTab === 'active' ? '3px solid #007bff' : 'none',
              borderRadius: '4px 4px 0 0',
              marginBottom: '-2px'
            }}
          >
            Active ({activeCount})
          </button>
          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
            style={{
              borderBottom: activeTab === 'history' ? '3px solid #007bff' : 'none',
              borderRadius: '4px 4px 0 0',
              marginBottom: '-2px'
            }}
          >
            📜 History ({historyCount})
          </button>
        </div>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="card">
          <p>
            {activeTab === 'history' 
              ? 'No completed tournaments in history yet.' 
              : activeTab === 'active'
              ? 'No active tournaments. Create a new tournament!'
              : 'No tournaments yet. Create your first tournament!'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: windowWidth < 480 ? '15px' : '20px' }}>
          <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table" style={{ minWidth: windowWidth < 768 ? '700px' : '100%', fontSize: windowWidth < 480 ? '13px' : '14px' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Teams</th>
                <th>Winner</th>
                <th>Runner-Up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTournaments.map(tournament => (
                <tr 
                  key={tournament._id}
                  style={{
                    opacity: tournament.status === 'completed' ? 0.9 : 1,
                    backgroundColor: tournament.status === 'completed' ? '#f8f9fa' : 'transparent'
                  }}
                >
                  <td>
                    <Link 
                      to={`/tournaments/${tournament._id}`} 
                      style={{ 
                        textDecoration: 'none', 
                        color: tournament.status === 'completed' ? '#6c757d' : '#007bff',
                        fontWeight: tournament.status === 'completed' ? 'normal' : '500'
                      }}
                    >
                      {tournament.status === 'completed' && '🏆 '}
                      {tournament.name}
                    </Link>
                  </td>
                  <td>{new Date(tournament.startDate).toLocaleDateString()}</td>
                  <td>{new Date(tournament.endDate).toLocaleDateString()}</td>
                  <td>{getStatusBadge(tournament.status)}</td>
                  <td>{tournament.teams?.length || 0}</td>
                  <td>
                    {(() => {
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
                      
                      // Helper function to get team info (handles both populated and unpopulated)
                      const getTeamInfo = (teamId, teamsArray) => {
                        if (!teamId) return null;
                        
                        // If teamId is already a populated object
                        if (teamId && typeof teamId === 'object' && teamId.name) {
                          return teamId;
                        }
                        
                        // If teamId is an ObjectId, find in teams array
                        if (teamsArray && Array.isArray(teamsArray)) {
                          const idStr = teamId._id ? teamId._id.toString() : teamId.toString();
                          return teamsArray.find(t => {
                            const teamIdStr = t._id ? t._id.toString() : t.toString();
                            return teamIdStr === idStr;
                          });
                        }
                        
                        return null;
                      };
                      
                      // Get runner-up from final match
                      const getRunnerUp = () => {
                        if (!tournament.finalMatch || !tournament.finalMatch.team1 || !tournament.finalMatch.team2) {
                          return null;
                        }
                        
                        const finalMatch = tournament.finalMatch;
                        const winnerId = tournament.winner 
                          ? (tournament.winner._id ? tournament.winner._id.toString() : tournament.winner.toString())
                          : null;
                        
                        if (!winnerId) return null;
                        
                        // Get team1 and team2 IDs
                        const team1Id = finalMatch.team1._id 
                          ? finalMatch.team1._id.toString() 
                          : (finalMatch.team1.toString ? finalMatch.team1.toString() : String(finalMatch.team1));
                        const team2Id = finalMatch.team2._id 
                          ? finalMatch.team2._id.toString() 
                          : (finalMatch.team2.toString ? finalMatch.team2.toString() : String(finalMatch.team2));
                        
                        // Find the runner-up (the team that's not the winner)
                        let runnerUp = null;
                        if (team1Id === winnerId) {
                          runnerUp = finalMatch.team2;
                        } else if (team2Id === winnerId) {
                          runnerUp = finalMatch.team1;
                        }
                        
                        // If runner-up is not populated, try to find in teams array
                        if (runnerUp && (!runnerUp.name || !runnerUp.players)) {
                          runnerUp = getTeamInfo(runnerUp, tournament.teams);
                        }
                        
                        return runnerUp;
                      };
                      
                      // Check if winner is populated (has name property)
                      if (tournament.winner && tournament.winner.name) {
                        const playerNames = getPlayerNames(tournament.winner);
                        return (
                          <div style={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}>
                            <span style={{ 
                              color: tournament.status === 'completed' ? '#28a745' : '#007bff', 
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              🏆 {tournament.winner.name}
                            </span>
                            {playerNames && playerNames.length > 0 && (
                              <span style={{ 
                                fontSize: '11px',
                                color: '#6c757d',
                                fontStyle: 'italic'
                              }}>
                                {playerNames}
                              </span>
                            )}
                          </div>
                        );
                      }
                      
                      // If winner is an ObjectId (not populated), try to find in teams array
                      if (tournament.winner && tournament.teams && Array.isArray(tournament.teams)) {
                        const winnerId = tournament.winner._id ? tournament.winner._id.toString() : tournament.winner.toString();
                        const winnerTeam = tournament.teams.find(t => {
                          const teamId = t._id ? t._id.toString() : t.toString();
                          return teamId === winnerId;
                        });
                        
                        if (winnerTeam && winnerTeam.name) {
                          const playerNames = getPlayerNames(winnerTeam);
                          return (
                            <div style={{ 
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px'
                            }}>
                              <span style={{ 
                                color: tournament.status === 'completed' ? '#28a745' : '#007bff', 
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                🏆 {winnerTeam.name}
                              </span>
                              {playerNames && playerNames.length > 0 && (
                                <span style={{ 
                                  fontSize: '11px',
                                  color: '#6c757d',
                                  fontStyle: 'italic'
                                }}>
                                  {playerNames}
                                </span>
                              )}
                            </div>
                          );
                        }
                      }
                      
                      // No winner set
                      return (
                        <span style={{ 
                          color: '#6c757d', 
                          fontStyle: 'italic'
                        }}>
                          {tournament.status === 'completed' ? 'No winner set' : 'TBD'}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
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
                      
                      // Helper function to get team info (handles both populated and unpopulated)
                      const getTeamInfo = (teamId, teamsArray) => {
                        if (!teamId) return null;
                        
                        // If teamId is already a populated object
                        if (teamId && typeof teamId === 'object' && teamId.name) {
                          return teamId;
                        }
                        
                        // If teamId is an ObjectId, find in teams array
                        if (teamsArray && Array.isArray(teamsArray)) {
                          const idStr = teamId._id ? teamId._id.toString() : teamId.toString();
                          return teamsArray.find(t => {
                            const teamIdStr = t._id ? t._id.toString() : t.toString();
                            return teamIdStr === idStr;
                          });
                        }
                        
                        return null;
                      };
                      
                      // Get runner-up from final match
                      const getRunnerUp = () => {
                        if (!tournament.finalMatch || !tournament.finalMatch.team1 || !tournament.finalMatch.team2) {
                          return null;
                        }
                        
                        const finalMatch = tournament.finalMatch;
                        const winnerId = tournament.winner 
                          ? (tournament.winner._id ? tournament.winner._id.toString() : tournament.winner.toString())
                          : null;
                        
                        if (!winnerId) return null;
                        
                        // Get team1 and team2 IDs
                        const team1Id = finalMatch.team1._id 
                          ? finalMatch.team1._id.toString() 
                          : (finalMatch.team1.toString ? finalMatch.team1.toString() : String(finalMatch.team1));
                        const team2Id = finalMatch.team2._id 
                          ? finalMatch.team2._id.toString() 
                          : (finalMatch.team2.toString ? finalMatch.team2.toString() : String(finalMatch.team2));
                        
                        // Find the runner-up (the team that's not the winner)
                        let runnerUp = null;
                        if (team1Id === winnerId) {
                          runnerUp = finalMatch.team2;
                        } else if (team2Id === winnerId) {
                          runnerUp = finalMatch.team1;
                        }
                        
                        // If runner-up is not populated, try to find in teams array
                        if (runnerUp && (!runnerUp.name || !runnerUp.players)) {
                          runnerUp = getTeamInfo(runnerUp, tournament.teams);
                        }
                        
                        return runnerUp;
                      };
                      
                      const runnerUp = getRunnerUp();
                      
                      if (runnerUp && runnerUp.name) {
                        const runnerUpPlayerNames = getPlayerNames(runnerUp);
                        return (
                          <div style={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}>
                            <span style={{ 
                              color: '#c0c0c0', 
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              🥈 {runnerUp.name}
                            </span>
                            {runnerUpPlayerNames && runnerUpPlayerNames.length > 0 ? (
                              <span style={{ 
                                fontSize: '11px',
                                color: '#6c757d',
                                fontStyle: 'italic',
                                display: 'block',
                                marginTop: '2px'
                              }}>
                                {runnerUpPlayerNames}
                              </span>
                            ) : (
                              // If players not populated, try to get from teams array
                              (() => {
                                const runnerUpFromTeams = getTeamInfo(runnerUp, tournament.teams);
                                if (runnerUpFromTeams) {
                                  const names = getPlayerNames(runnerUpFromTeams);
                                  if (names && names.length > 0) {
                                    return (
                                      <span style={{ 
                                        fontSize: '11px',
                                        color: '#6c757d',
                                        fontStyle: 'italic',
                                        display: 'block',
                                        marginTop: '2px'
                                      }}>
                                        {names}
                                      </span>
                                    );
                                  }
                                }
                                return null;
                              })()
                            )}
                          </div>
                        );
                      }
                      
                      // No runner-up
                      return (
                        <span style={{ 
                          color: '#6c757d', 
                          fontStyle: 'italic'
                        }}>
                          {tournament.status === 'completed' ? '-' : 'TBD'}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <Link to={`/tournaments/${tournament._id}`} className="btn btn-primary" style={{ padding: windowWidth < 480 ? '4px 8px' : '5px 10px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}>
                        View
                      </Link>
                      {tournament.status !== 'completed' && (
                        <button className="btn btn-danger" onClick={() => handleDelete(tournament._id)} style={{ padding: windowWidth < 480 ? '4px 8px' : '5px 10px', fontSize: windowWidth < 480 ? '12px' : '14px', whiteSpace: 'nowrap' }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create Tournament</h2>
              <span className="close" onClick={() => {
                setShowModal(false);
                setFormData({ name: '', startDate: getTodayDate(), endDate: getTodayDate(), description: '', status: 'upcoming' });
              }}>&times;</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tournament Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowModal(false);
                  setFormData({ name: '', startDate: getTodayDate(), endDate: getTodayDate(), description: '', status: 'upcoming' });
                }}>
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

      {showPinModal && (
        <PinVerification
          onVerify={handlePinVerify}
          onCancel={handlePinCancel}
          action="delete this tournament"
        />
      )}
    </div>
  );
};

export default Tournaments;

