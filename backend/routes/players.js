const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const requirePin = require('../middleware/requirePin');

// Helper function to calculate player statistics from matches and tournaments
const calculatePlayerStats = async (playerId) => {
  try {
    // Find all teams that include this player (populate tournament for tournamentsPlayed calculation)
    const teams = await Team.find({ players: playerId }).populate('tournament');
    
    if (teams.length === 0) {
      return { matchesWon: 0, matchesLost: 0, winPercentage: 0, tournamentsWon: 0, tournamentsPlayed: 0, totalMatches: 0, finalMatches: 0, semiFinalMatches: 0 };
    }
    
    // Convert team IDs to strings for comparison (normalize all to strings)
    const teamIds = teams.map(t => {
      const id = t._id;
      return id.toString ? id.toString() : String(id);
    });
    const teamObjectIds = teams.map(t => t._id);
    
    // Find ONLY completed matches where this player's teams participated
    const completedMatches = await Match.find({
      status: 'completed',
      winner: { $exists: true, $ne: null },
      $or: [
        { team1: { $in: teamObjectIds } },
        { team2: { $in: teamObjectIds } }
      ]
    }).lean();
    
    let matchesWon = 0;
    let matchesLost = 0;
    let totalMatchesCount = 0;
    let finalMatchesCount = 0;
    let semiFinalMatchesCount = 0;
    
    // Helper function to safely get ID as string
    const getIdAsString = (id) => {
      if (!id) return null;
      if (typeof id === 'string') return id;
      // Handle ObjectId
      if (id.toString && typeof id.toString === 'function') return id.toString();
      // Handle object with _id
      if (id._id) {
        const innerId = id._id;
        return innerId.toString ? innerId.toString() : String(innerId);
      }
      return String(id);
    };
    
    // Count only completed matches (for total, final, semi-final counts)
    for (const match of completedMatches) {
      if (!match.team1 || !match.team2) continue; // Skip if no team1 or team2
      
      // Convert all IDs to strings for reliable comparison
      const team1Id = getIdAsString(match.team1);
      const team2Id = getIdAsString(match.team2);
      
      // Check which of the player's teams participated in this match
      const playerTeam1 = teamIds.includes(team1Id);
      const playerTeam2 = teamIds.includes(team2Id);
      
      if (playerTeam1 || playerTeam2) {
        // Player's team participated in this completed match
        totalMatchesCount++;
        
        // Count by match type - check both string and default value
        const matchType = match.matchType || 'group';
        if (matchType === 'final') {
          finalMatchesCount++;
        } else if (matchType === 'semifinal') {
          semiFinalMatchesCount++;
        }
      }
    }
    
    // Calculate wins and losses from completed matches only
    for (const match of completedMatches) {
      // Skip matches without team2 or winner
      if (!match.team2 || !match.winner) continue;
      
      // Convert all IDs to strings for reliable comparison
      const winnerId = getIdAsString(match.winner);
      const team1Id = getIdAsString(match.team1);
      const team2Id = getIdAsString(match.team2);
      
      // Check which of the player's teams participated in this match
      const playerTeam1 = teamIds.includes(team1Id);
      const playerTeam2 = teamIds.includes(team2Id);
      
      if (playerTeam1 || playerTeam2) {
        // Count wins and losses
        if (winnerId === team1Id && playerTeam1) {
          matchesWon++;
        } else if (winnerId === team2Id && playerTeam2) {
          matchesWon++;
        } else if (playerTeam1 || playerTeam2) {
          // Player's team participated but didn't win (lost)
          matchesLost++;
        }
      }
    }
    
    // Calculate win percentage
    const totalMatches = matchesWon + matchesLost;
    const winPercentage = totalMatches > 0 ? ((matchesWon / totalMatches) * 100).toFixed(1) : 0;
    
    // Count tournaments won by this player's teams
    const tournamentsWon = await Tournament.countDocuments({
      status: 'completed',
      winner: { $in: teams.map(t => t._id) }
    });
    
    // Count unique tournaments from teams
    // Handle both populated tournament objects and tournament IDs
    const uniqueTournamentIds = [...new Set(teams.map(t => {
      if (!t.tournament) return null;
      
      // If tournament is populated (object with _id)
      if (typeof t.tournament === 'object' && t.tournament._id) {
        return t.tournament._id.toString();
      }
      
      // If tournament is just an ID (ObjectId or string)
      if (t.tournament.toString && typeof t.tournament.toString === 'function') {
        return t.tournament.toString();
      }
      
      // Fallback to string conversion
      return String(t.tournament);
    }).filter(Boolean))];
    
    const tournamentsPlayedCount = uniqueTournamentIds.length;
    
    const result = { 
      matchesWon, 
      matchesLost, 
      winPercentage: parseFloat(winPercentage),
      tournamentsWon,
      tournamentsPlayed: tournamentsPlayedCount,
      totalMatches: totalMatchesCount,
      finalMatches: finalMatchesCount,
      semiFinalMatches: semiFinalMatchesCount
    };
    
    // Debug: log final result for first player
    if (playerId.toString().includes('6915abcda559081cd1683b78') || playerId.toString().includes('6915abd7a559081cd1683b7b')) {
      console.log(`[Player Stats Final] Player: ${playerId}, Result:`, JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    console.error('Error calculating player stats:', error);
    return { matchesWon: 0, matchesLost: 0, winPercentage: 0, tournamentsWon: 0, tournamentsPlayed: 0, totalMatches: 0, finalMatches: 0, semiFinalMatches: 0 };
  }
};

// Get all players with dynamic stats
router.get('/', async (req, res) => {
  try {
    const players = await Player.find().sort({ name: 1 });
    
    // Calculate stats for each player
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await calculatePlayerStats(player._id);
        return {
          ...player.toObject(),
          matchesWon: stats.matchesWon,
          matchesLost: stats.matchesLost,
          winPercentage: stats.winPercentage,
          tournamentsWon: stats.tournamentsWon,
          tournamentsPlayed: stats.tournamentsPlayed,
          totalMatches: stats.totalMatches,
          finalMatches: stats.finalMatches,
          semiFinalMatches: stats.semiFinalMatches
        };
      })
    );
    
    res.json(playersWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single player
router.get('/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Calculate and add stats
    const stats = await calculatePlayerStats(player._id);
    const playerWithStats = {
      ...player.toObject(),
      matchesWon: stats.matchesWon,
      matchesLost: stats.matchesLost,
      winPercentage: stats.winPercentage,
      tournamentsWon: stats.tournamentsWon,
      totalMatches: stats.totalMatches,
      finalMatches: stats.finalMatches,
      semiFinalMatches: stats.semiFinalMatches
    };
    
    res.json(playerWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create player (PIN protected)
router.post('/', requirePin, async (req, res) => {
  try {
    // Only allow name field, ignore email, phone, rating
    const playerData = {
      name: req.body.name
    };
    const player = new Player(playerData);
    await player.save();
    
    // Calculate and add stats
    const stats = await calculatePlayerStats(player._id);
    const playerWithStats = {
      ...player.toObject(),
      matchesWon: stats.matchesWon,
      matchesLost: stats.matchesLost,
      winPercentage: stats.winPercentage,
      tournamentsWon: stats.tournamentsWon,
      totalMatches: stats.totalMatches,
      finalMatches: stats.finalMatches,
      semiFinalMatches: stats.semiFinalMatches
    };
    
    res.status(201).json(playerWithStats);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update player (PIN protected)
router.put('/:id', requirePin, async (req, res) => {
  try {
    // Only allow name field to be updated
    const updateData = {
      name: req.body.name
    };
    
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Calculate and add stats
    const stats = await calculatePlayerStats(player._id);
    const playerWithStats = {
      ...player.toObject(),
      matchesWon: stats.matchesWon,
      matchesLost: stats.matchesLost,
      winPercentage: stats.winPercentage,
      tournamentsWon: stats.tournamentsWon,
      totalMatches: stats.totalMatches,
      finalMatches: stats.finalMatches,
      semiFinalMatches: stats.semiFinalMatches
    };
    
    res.json(playerWithStats);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete player (PIN protected)
router.delete('/:id', requirePin, async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

