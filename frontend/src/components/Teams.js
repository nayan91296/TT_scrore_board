import React, { useState, useEffect } from 'react';
import { getTeams, getTournaments, getPlayers, createTeam, deleteTeam } from '../services/api';
import PinVerification from './PinVerification';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]); // Store all teams
  const [tournaments, setTournaments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(''); // Filter by tournament
  const [showModal, setShowModal] = useState(false);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tournament: '',
    players: []
  });
  const [randomTeamForm, setRandomTeamForm] = useState({
    tournament: '',
    numberOfTeams: 0,
    playersPerTeam: 0
  });
  const [selectedPlayersForRandom, setSelectedPlayersForRandom] = useState([]);
  
  // PIN verification state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState({
    submit: false,
    delete: null,
    generateRandom: false,
    loadingTeams: true,
    loadingTournaments: true,
    loadingPlayers: true
  });

  useEffect(() => {
    loadTeams();
    loadTournaments();
    loadPlayers();
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

  const loadTeams = async () => {
    setLoading(prev => ({ ...prev, loadingTeams: true }));
    try {
      const response = await getTeams();
      setAllTeams(response.data);
      setTeams(response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
      alert('Failed to load teams');
    } finally {
      setLoading(prev => ({ ...prev, loadingTeams: false }));
    }
  };

  const loadTournaments = async () => {
    setLoading(prev => ({ ...prev, loadingTournaments: true }));
    try {
      const response = await getTournaments();
      setTournaments(response.data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(prev => ({ ...prev, loadingTournaments: false }));
    }
  };

  const loadPlayers = async () => {
    setLoading(prev => ({ ...prev, loadingPlayers: true }));
    try {
      const response = await getPlayers();
      setPlayers(response.data);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(prev => ({ ...prev, loadingPlayers: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tournament || formData.players.length === 0) {
      alert('Please select a tournament and at least one player');
      return;
    }
    setLoading(prev => ({ ...prev, submit: true }));
    try {
      await createTeam(formData);
      setShowModal(false);
      setFormData({ name: '', tournament: '', players: [] });
      loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      alert(error.response?.data?.error || 'Failed to create team');
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handlePlayerToggle = (playerId) => {
    if (formData.players.includes(playerId)) {
      setFormData({ ...formData, players: formData.players.filter(id => id !== playerId) });
    } else {
      setFormData({ ...formData, players: [...formData.players, playerId] });
    }
  };

  const handleDelete = (id) => {
    setPendingAction(() => async () => {
      setLoading(prev => ({ ...prev, delete: id }));
      try {
        await deleteTeam(id);
        loadTeams();
      } catch (error) {
        console.error('Error deleting team:', error);
        alert('Failed to delete team');
      } finally {
        setLoading(prev => ({ ...prev, delete: null }));
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

    // Check if tournament already has teams
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

    setLoading(prev => ({ ...prev, generateRandom: true }));
    try {
      // Shuffle players array
      const shuffledPlayers = [...availablePlayers].sort(() => Math.random() - 0.5);
      
      // Create teams
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

      // Create all teams
      for (const teamData of teamsToCreate) {
        await createTeam(teamData);
      }

      setShowRandomModal(false);
      setRandomTeamForm({ tournament: '', numberOfTeams: 0, playersPerTeam: 0 });
      setSelectedPlayersForRandom([]);
      loadTeams();
      alert(`Successfully created ${randomTeamForm.numberOfTeams} team(s) for the tournament!`);
    } catch (error) {
      console.error('Error generating random teams:', error);
      alert(error.response?.data?.error || 'Failed to generate random teams');
    } finally {
      setLoading(prev => ({ ...prev, generateRandom: false }));
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
        <h1 style={{ margin: 0, fontSize: window.innerWidth < 768 ? '24px' : '32px' }}>Teams</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowRandomModal(true)}>
            🎲 Generate Random Teams
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Create Team
          </button>
        </div>
      </div>

      {/* Tournament Filter */}
      <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold' }}>Filter by Tournament:</label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ddd', minWidth: '200px' }}
          >
            <option value="">All Tournaments</option>
            {tournaments.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
          {selectedTournament && (
            <span style={{ color: '#666', fontSize: '14px' }}>
              Showing {teams.length} team(s) for selected tournament
            </span>
          )}
        </div>
      </div>

      {loading.loadingTeams ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '32px', marginBottom: '15px' }}>⏳</div>
          <div style={{ fontSize: '16px', color: '#666' }}>Loading teams...</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="card">
          <p>No teams yet. Create your first team!</p>
        </div>
      ) : (
        (() => {
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

          // Color palette for tournaments
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

          const tournamentEntries = Object.entries(teamsByTournament);
          
          return (
            <div>
              {tournamentEntries.map(([tournamentId, tournamentData], index) => {
                const colorScheme = tournamentColors[index % tournamentColors.length];
                return (
                  <div key={tournamentId} className="card" style={{ 
                    marginBottom: '20px',
                    border: `2px solid ${colorScheme.border}`,
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {/* Tournament Header */}
                    <div style={{
                      background: `linear-gradient(135deg, ${colorScheme.header} 0%, ${colorScheme.border} 100%)`,
                      color: 'white',
                      padding: '15px 20px',
                      margin: '-1px -1px 0 -1px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                          🏆 {tournamentData.name}
                        </h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                          {tournamentData.teams.length} team(s)
                        </p>
                      </div>
                      {tournamentData.tournament && (
                        <div style={{ textAlign: 'right', fontSize: '12px', opacity: 0.9 }}>
                          {tournamentData.tournament.status && (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: 'rgba(255,255,255,0.2)',
                              textTransform: 'uppercase',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {tournamentData.tournament.status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Teams Table */}
                    <div style={{ background: colorScheme.bg, padding: '15px' }}>
                      <div className="table-responsive" style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ margin: 0, background: 'white', minWidth: window.innerWidth < 768 ? '600px' : '100%' }}>
                        <thead>
                          <tr style={{ background: colorScheme.border, color: 'white' }}>
                            <th style={{ color: 'white' }}>Team Name</th>
                            <th style={{ color: 'white' }}>Players</th>
                            <th style={{ color: 'white', textAlign: 'center' }}>Matches Won</th>
                            <th style={{ color: 'white', textAlign: 'center' }}>Points</th>
                            <th style={{ color: 'white' }}>Actions</th>
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
                              <td>
                                <strong style={{ color: colorScheme.header }}>{team.name}</strong>
                              </td>
                              <td>
                                {team.players?.map((p, idx) => (
                                  <span key={p._id} style={{ fontSize: '13px' }}>
                                    {p.name}
                                    {idx < team.players.length - 1 ? ', ' : ''}
                                  </span>
                                )) || '-'}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>
                                {team.matchesWon || 0}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: colorScheme.header, fontSize: '16px' }}>
                                {team.points || 0}
                              </td>
                              <td>
                                <button 
                                  className="btn btn-danger" 
                                  onClick={() => handleDelete(team._id)} 
                                  disabled={loading.delete === team._id}
                                  style={{ padding: '5px 10px', fontSize: '14px' }}
                                >
                                  {loading.delete === team._id ? '⏳ Deleting...' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create Team</h2>
              <span className="close" onClick={() => setShowModal(false)}>&times;</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Team Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tournament *</label>
                <select
                  required
                  value={formData.tournament}
                  onChange={(e) => setFormData({ ...formData, tournament: e.target.value })}
                >
                  <option value="">Select Tournament</option>
                  {tournaments.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Select Players *</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '5px' }}>
                  {players
                    .filter(player => {
                      // Show all players (players are not tournament-specific, teams are)
                      return true;
                    })
                    .map(player => (
                      <label key={player._id} style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={formData.players.includes(player._id)}
                          onChange={() => handlePlayerToggle(player._id)}
                          style={{ marginRight: '8px' }}
                        />
                        {player.name}
                      </label>
                    ))}
                </div>
                {formData.players.length > 0 && (
                  <p style={{ marginTop: '5px', color: '#666', fontSize: '14px' }}>
                    {formData.players.length} player(s) selected
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading.submit}>
                  {loading.submit ? '⏳ Creating...' : 'Create'}
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
                <label>Number of Teams *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="20"
                  value={randomTeamForm.numberOfTeams}
                  onChange={(e) => setRandomTeamForm({ ...randomTeamForm, numberOfTeams: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Players per Team *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="10"
                  value={randomTeamForm.playersPerTeam}
                  onChange={(e) => setRandomTeamForm({ ...randomTeamForm, playersPerTeam: parseInt(e.target.value) || 0 })}
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
              {randomTeamForm.tournament && (
                <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '5px', marginBottom: '15px' }}>
                  <strong>Selected Players:</strong> {selectedPlayersForRandom.length}
                  <br />
                  <strong>Players Needed:</strong> {randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam}
                  <br />
                  <strong>Existing Teams in Tournament:</strong> {
                    allTeams.filter(team => 
                      team.tournament?._id === randomTeamForm.tournament || 
                      team.tournament === randomTeamForm.tournament ||
                      team.tournament?._id?.toString() === randomTeamForm.tournament
                    ).length
                  }
                  {selectedPlayersForRandom.length < randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam && (
                    <div style={{ color: '#d32f2f', marginTop: '5px', fontWeight: 'bold' }}>
                      ⚠️ Not enough selected players! Need {randomTeamForm.numberOfTeams * randomTeamForm.playersPerTeam} but only {selectedPlayersForRandom.length} selected.
                    </div>
                  )}
                </div>
              )}
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
                <button type="submit" className="btn btn-primary" disabled={loading.generateRandom}>
                  {loading.generateRandom ? '⏳ Generating...' : 'Generate Teams'}
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
          action="delete this team"
        />
      )}
    </div>
  );
};

export default Teams;

