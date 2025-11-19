import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import Tournaments from './components/Tournaments';
import PlayersAndTeams from './components/PlayersAndTeams';
import TournamentDetail from './components/TournamentDetail';
import PlayerRankings from './components/PlayerRankings';
import PlayerHeadToHead from './components/PlayerHeadToHead';
import StatisticsDashboard from './components/StatisticsDashboard';
import MatchHistory from './components/MatchHistory';

const NavLinks = () => {
  const location = useLocation();
  
  return (
    <nav>
      <Link 
        to="/" 
        className={location.pathname === '/' || location.pathname.startsWith('/tournaments/') ? 'active' : ''}
      >
        Tournaments
      </Link>
      <Link 
        to="/players-teams" 
        className={location.pathname === '/players-teams' || location.pathname === '/players' || location.pathname === '/teams' ? 'active' : ''}
      >
        Players & Teams
      </Link>
      <Link 
        to="/rankings" 
        className={location.pathname === '/rankings' ? 'active' : ''}
      >
        Rankings
      </Link>
      <Link 
        to="/head-to-head" 
        className={location.pathname === '/head-to-head' ? 'active' : ''}
      >
        Head-to-Head
      </Link>
      <Link 
        to="/statistics" 
        className={location.pathname === '/statistics' ? 'active' : ''}
      >
        Statistics
      </Link>
      <Link 
        to="/match-history" 
        className={location.pathname === '/match-history' ? 'active' : ''}
      >
        Match History
      </Link>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <div className="navbar">
          <div className="container">
            <h1>🏓 TT Tournament Manager</h1>
            <NavLinks />
          </div>
        </div>
        <div className="container" style={{ maxWidth: '100%', padding: '0 20px', paddingTop: '100px' }}>
          <Routes>
            <Route path="/" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/players-teams" element={<PlayersAndTeams />} />
            <Route path="/rankings" element={<PlayerRankings />} />
            <Route path="/head-to-head" element={<PlayerHeadToHead />} />
            <Route path="/statistics" element={<StatisticsDashboard />} />
            <Route path="/match-history" element={<MatchHistory />} />
            {/* Keep old routes for backward compatibility */}
            <Route path="/players" element={<PlayersAndTeams />} />
            <Route path="/teams" element={<PlayersAndTeams />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

