import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import Tournaments from './components/Tournaments';
import PlayersAndTeams from './components/PlayersAndTeams';
import TournamentDetail from './components/TournamentDetail';
import PlayerRankings from './components/PlayerRankings';
import PlayerHeadToHead from './components/PlayerHeadToHead';
import StatisticsDashboard from './components/StatisticsDashboard';
import MatchHistory from './components/MatchHistory';

const NavLinks = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const location = useLocation();
  
  const handleLinkClick = () => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };
  
  return (
    <nav className={isMobileMenuOpen ? 'mobile-menu-open' : ''}>
      <Link 
        to="/" 
        className={location.pathname === '/' || location.pathname.startsWith('/tournaments/') ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Tournaments
      </Link>
      <Link 
        to="/players-teams" 
        className={location.pathname === '/players-teams' || location.pathname === '/players' || location.pathname === '/teams' ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Players & Teams
      </Link>
      <Link 
        to="/rankings" 
        className={location.pathname === '/rankings' ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Rankings
      </Link>
      <Link 
        to="/head-to-head" 
        className={location.pathname === '/head-to-head' ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Head-to-Head
      </Link>
      <Link 
        to="/statistics" 
        className={location.pathname === '/statistics' ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Statistics
      </Link>
      <Link 
        to="/match-history" 
        className={location.pathname === '/match-history' ? 'active' : ''}
        onClick={handleLinkClick}
      >
        Match History
      </Link>
    </nav>
  );
};

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      // Close mobile menu when window is resized to desktop size
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen && windowWidth <= 768) {
        const nav = document.querySelector('.navbar nav');
        const toggle = document.querySelector('.mobile-menu-toggle');
        if (nav && toggle && !nav.contains(event.target) && !toggle.contains(event.target)) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMobileMenuOpen, windowWidth]);

  return (
    <Router>
      <div className="App">
        <div className="navbar">
          <div className="container">
            <h1>🏓 TT Tournament Manager</h1>
            <button 
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
            <NavLinks 
              isMobileMenuOpen={isMobileMenuOpen} 
              setIsMobileMenuOpen={setIsMobileMenuOpen} 
            />
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

