import React, { useState, useEffect } from 'react';
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../services/api';
import PinVerification from './PinVerification';

const Players = () => {
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('winPercentage'); // winPercentage, name, totalMatches, tournamentsWon, rating
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rating: 0
  });
  const [loading, setLoading] = useState({
    submit: false,
    delete: null, // Store the ID of the item being deleted
    loadingPlayers: true
  });

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(prev => ({ ...prev, loadingPlayers: true }));
    try {
      const response = await getPlayers();
      setAllPlayers(response.data);
      applyFiltersAndSort(response.data);
    } catch (error) {
      console.error('Error loading players:', error);
      alert('Failed to load players');
    } finally {
      setLoading(prev => ({ ...prev, loadingPlayers: false }));
    }
  };

  const applyFiltersAndSort = (playersList = allPlayers) => {
    // Filter by search term
    let filtered = playersList;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = playersList.filter(player => 
        player.name.toLowerCase().includes(term) ||
        (player.email && player.email.toLowerCase().includes(term)) ||
        (player.phone && player.phone.includes(term))
      );
    }

    // Sort players
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'totalMatches':
          return (b.totalMatches || 0) - (a.totalMatches || 0);
        case 'tournamentsWon':
          return (b.tournamentsWon || 0) - (a.tournamentsWon || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'winPercentage':
        default:
          const aMatchesWon = a.matchesWon || 0;
          const aMatchesLost = a.matchesLost || 0;
          const aTotalMatches = aMatchesWon + aMatchesLost;
          const aWinPercentage = aTotalMatches > 0 ? (aMatchesWon / aTotalMatches) * 100 : 0;
          
          const bMatchesWon = b.matchesWon || 0;
          const bMatchesLost = b.matchesLost || 0;
          const bTotalMatches = bMatchesWon + bMatchesLost;
          const bWinPercentage = bTotalMatches > 0 ? (bMatchesWon / bTotalMatches) * 100 : 0;
          
          return bWinPercentage - aWinPercentage;
      }
    });
    
    setPlayers(sorted);
  };

  useEffect(() => {
    if (allPlayers.length > 0) {
      applyFiltersAndSort(allPlayers);
    }
  }, [searchTerm, sortBy, allPlayers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, submit: true }));
    try {
      if (editingPlayer) {
        await updatePlayer(editingPlayer._id, formData);
      } else {
        await createPlayer(formData);
      }
      setShowModal(false);
      setEditingPlayer(null);
      setFormData({ name: '', email: '', phone: '', rating: 0 });
      loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Failed to save player');
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleEdit = (player) => {
    setPendingAction(() => () => {
      setEditingPlayer(player);
      setFormData({
        name: player.name,
        email: player.email || '',
        phone: player.phone || '',
        rating: player.rating || 0
      });
      setShowModal(true);
    });
    setPendingActionType('edit');
    setShowPinModal(true);
  };

  const handleDelete = (id) => {
    setPendingAction(() => async () => {
      setLoading(prev => ({ ...prev, delete: id }));
      try {
        await deletePlayer(id);
        loadPlayers();
      } catch (error) {
        console.error('Error deleting player:', error);
        alert('Failed to delete player');
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

  const closeModal = () => {
    setShowModal(false);
    setEditingPlayer(null);
    setFormData({ name: '', email: '', phone: '', rating: 0 });
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
        <h1 style={{ margin: 0, fontSize: window.innerWidth < 768 ? '24px' : '32px' }}>Players</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Player
        </button>
      </div>

      {/* Search and Sort Controls */}
      {allPlayers.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                🔍 Search Players
              </label>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                📊 Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="winPercentage">Win Percentage</option>
                <option value="name">Name (A-Z)</option>
                <option value="totalMatches">Total Matches</option>
                <option value="tournamentsWon">Tournaments Won</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>
          {searchTerm && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              Showing {players.length} of {allPlayers.length} players
            </div>
          )}
        </div>
      )}

      {loading.loadingPlayers ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '32px', marginBottom: '15px' }}>⏳</div>
          <div style={{ fontSize: '16px', color: '#666' }}>Loading players...</div>
        </div>
      ) : allPlayers.length === 0 ? (
        <div className="card">
          <p>No players yet. Add your first player!</p>
        </div>
      ) : players.length === 0 ? (
        <div className="card">
          <p>No players found matching your search. Try a different search term.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: window.innerWidth < 768 ? '800px' : '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>Rank</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={{ textAlign: 'center' }}>Rating</th>
                <th style={{ textAlign: 'center' }}>Total Matches</th>
                <th style={{ textAlign: 'center' }}>Won</th>
                <th style={{ textAlign: 'center' }}>Lost</th>
                <th style={{ textAlign: 'center' }}>Win %</th>
                <th style={{ textAlign: 'center' }}>🏆 Tournaments</th>
                <th style={{ textAlign: 'center' }}>Final</th>
                <th style={{ textAlign: 'center' }}>Semi-Final</th>
                {/* <th>Joined</th> */}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => {
                const matchesWon = player.matchesWon || 0;
                const matchesLost = player.matchesLost || 0;
                const totalMatches = matchesWon + matchesLost;
                const winPercentage = player.winPercentage !== undefined && player.winPercentage !== null 
                  ? player.winPercentage 
                  : (totalMatches > 0 ? parseFloat(((matchesWon / totalMatches) * 100).toFixed(1)) : 0);
                const tournamentsWon = player.tournamentsWon || 0;
                const rank = index + 1;
                const isTopThree = rank <= 3 && sortBy === 'winPercentage' && totalMatches > 0;
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
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                    {rank === 1 && isTopThree && '🥇'}
                    {rank === 2 && isTopThree && '🥈'}
                    {rank === 3 && isTopThree && '🥉'}
                    {!isTopThree && rank}
                  </td>
                  <td>
                    <strong>{player.name}</strong>
                    {isTopThree && <span style={{ marginLeft: '5px', color: '#4caf50' }}>⭐</span>}
                  </td>
                  <td>{player.email || '-'}</td>
                  <td>{player.phone || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{player.rating || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{player.totalMatches || 0}</td>
                  <td style={{ textAlign: 'center', color: '#4caf50', fontWeight: 'bold' }}>{matchesWon}</td>
                  <td style={{ textAlign: 'center', color: '#f44336', fontWeight: 'bold' }}>{matchesLost}</td>
                  <td style={{ 
                    textAlign: 'center', 
                    fontWeight: 'bold', 
                    color: winPercentage >= 70 ? '#4caf50' : winPercentage >= 50 ? '#8bc34a' : winPercentage > 0 ? '#ff9800' : '#666',
                    fontSize: '15px'
                  }}>
                    {winPercentage}%
                  </td>
                  <td style={{ 
                    textAlign: 'center', 
                    fontWeight: 'bold', 
                    color: tournamentsWon > 0 ? '#ff9800' : '#666',
                    fontSize: '16px'
                  }}>
                    {tournamentsWon > 0 ? '🏆 ' : ''}{tournamentsWon}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ff9800' }}>{player.finalMatches || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2196f3' }}>{player.semiFinalMatches || 0}</td>
                  {/* <td style={{ fontSize: '13px', color: '#666' }}>{joinedDate}</td> */}
                  <td>
                    <button className="btn btn-primary" onClick={() => handleEdit(player)} style={{ marginRight: '5px', padding: '5px 10px', fontSize: '14px' }}>
                      Edit
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(player._id)} 
                      disabled={loading.delete === player._id}
                      style={{ padding: '5px 10px', fontSize: '14px' }}
                    >
                      {loading.delete === player._id ? '⏳ Deleting...' : 'Delete'}
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

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingPlayer ? 'Edit Player' : 'Add Player'}</h2>
              <span className="close" onClick={closeModal}>&times;</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Rating</label>
                <input
                  type="number"
                  min="0"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading.submit}>
                  {loading.submit ? '⏳ Loading...' : (editingPlayer ? 'Update' : 'Create')}
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
          action={pendingActionType === 'delete' ? 'delete this player' : 'edit this player'}
        />
      )}
    </div>
  );
};

export default Players;

