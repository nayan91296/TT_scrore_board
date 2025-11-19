import axios from 'axios';

// Get API URL from environment variable, fallback to default
const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.212.209:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tournament APIs
export const getTournaments = (status) => {
  const url = status ? `/tournaments?status=${status}` : '/tournaments';
  return api.get(url);
};
export const getTournamentHistory = () => api.get('/tournaments/history');
export const getTournament = (id) => api.get(`/tournaments/${id}`);
export const createTournament = (data) => api.post('/tournaments', data);
export const updateTournament = (id, data) => api.put(`/tournaments/${id}`, data);
export const deleteTournament = (id) => api.delete(`/tournaments/${id}`);
export const generateSemiFinals = (id) => api.post(`/tournaments/${id}/semifinals`);
export const generateFinal = (id) => api.post(`/tournaments/${id}/final`);
export const generateGroupMatches = (id, replace = false) => api.post(`/tournaments/${id}/generate-group-matches`, { replace });

// Player APIs
export const getPlayers = () => api.get('/players');
export const getPlayer = (id) => api.get(`/players/${id}`);
export const createPlayer = (data) => api.post('/players', data);
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
export const deletePlayer = (id) => api.delete(`/players/${id}`);

// Team APIs
export const getTeams = () => api.get('/teams');
export const getTeamsByTournament = (tournamentId) => api.get(`/teams/tournament/${tournamentId}`);
export const getTeam = (id) => api.get(`/teams/${id}`);
export const getTeamPastRecord = (id) => api.get(`/teams/${id}/past-record`);
export const createTeam = (data) => api.post('/teams', data);
export const updateTeam = (id, data) => api.put(`/teams/${id}`, data);
export const deleteTeam = (id) => api.delete(`/teams/${id}`);
export const recalculateTeamStats = (tournamentId) => api.post(`/teams/tournament/${tournamentId}/recalculate`);

// Match APIs
export const getMatches = () => api.get('/matches');
export const getMatchesByTournament = (tournamentId) => api.get(`/matches/tournament/${tournamentId}`);
export const getMatch = (id) => api.get(`/matches/${id}`);
export const createMatch = (data) => api.post('/matches', data);
export const updateMatch = (id, data) => api.put(`/matches/${id}`, data);
export const completeMatch = (id, winnerId) => api.put(`/matches/${id}`, { status: 'completed', winner: winnerId });
export const addScore = (id, data) => api.post(`/matches/${id}/score`, data);
export const performToss = (id) => api.post(`/matches/${id}/toss`);
export const deleteMatch = (id) => api.delete(`/matches/${id}`);

export default api;

