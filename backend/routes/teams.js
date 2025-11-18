const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');

// Get all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('players')
      .populate('tournament')
      .sort({ createdAt: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get teams by tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournament: req.params.tournamentId })
      .populate('players');
    
    // Get completed matches for head-to-head calculation
    const matches = await Match.find({ 
      tournament: req.params.tournamentId, 
      status: 'completed' 
    }).populate('team1').populate('team2').populate('winner');
    
    // Sort with tie-breaking logic
    const sortedTeams = teams.sort((a, b) => {
      // 1. Primary: Points (descending)
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }

      // 2. Tie-breaker 1: Head-to-head record
      const h2hMatches = matches.filter(match => 
        match.winner &&
        ((match.team1?._id?.toString() === a._id.toString() && match.team2?._id?.toString() === b._id.toString()) ||
         (match.team1?._id?.toString() === b._id.toString() && match.team2?._id?.toString() === a._id.toString()))
      );

      if (h2hMatches.length > 0) {
        let aWins = 0, bWins = 0;
        h2hMatches.forEach(match => {
          const winnerId = match.winner?._id?.toString();
          if (winnerId === a._id.toString()) aWins++;
          else if (winnerId === b._id.toString()) bWins++;
        });
        if (aWins !== bWins) {
          return bWins - aWins; // If b wins more, b ranks higher (positive), if a wins more, a ranks higher (negative)
        }
      }

      // 3. Tie-breaker 2: Number of wins
      if ((b.matchesWon || 0) !== (a.matchesWon || 0)) {
        return (b.matchesWon || 0) - (a.matchesWon || 0);
      }

      // 4. Tie-breaker 3: Win percentage
      const aWinRate = (a.matchesPlayed || 0) > 0 ? (a.matchesWon || 0) / (a.matchesPlayed || 1) : 0;
      const bWinRate = (b.matchesPlayed || 0) > 0 ? (b.matchesWon || 0) / (b.matchesPlayed || 1) : 0;
      if (bWinRate !== aWinRate) {
        return bWinRate - aWinRate;
      }

      // 5. Tie-breaker 4: Fewer losses
      if ((a.matchesLost || 0) !== (b.matchesLost || 0)) {
        return (a.matchesLost || 0) - (b.matchesLost || 0);
      }

      // 6. Last resort: Alphabetical
      return a.name.localeCompare(b.name);
    });
    
    res.json(sortedTeams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single team
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('players')
      .populate('tournament');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create team
router.post('/', async (req, res) => {
  try {
    const { tournament, players } = req.body;

    // Validate tournament exists
    const tournamentExists = await Tournament.findById(tournament);
    if (!tournamentExists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Validate players
    if (!players || players.length < 1) {
      return res.status(400).json({ error: 'Team must have at least one player' });
    }

    const team = new Team(req.body);
    await team.save();

    // Add team to tournament
    await Tournament.findByIdAndUpdate(tournament, {
      $push: { teams: team._id }
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('players')
      .populate('tournament');

    res.status(201).json(populatedTeam);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update team
router.put('/:id', async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('players').populate('tournament');
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Recalculate team statistics from matches (only group matches)
router.post('/tournament/:tournamentId/recalculate', async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const teams = await Team.find({ tournament: tournamentId });
    // Only count GROUP matches for points table
    const matches = await Match.find({ 
      tournament: tournamentId, 
      status: 'completed',
      matchType: 'group'  // Only group matches affect points table
    });

    // Reset all team stats
    for (const team of teams) {
      team.matchesPlayed = 0;
      team.matchesWon = 0;
      team.matchesLost = 0;
      team.points = 0;
      await team.save();
    }

    // Recalculate from completed GROUP matches only
    for (const match of matches) {
      if (match.winner && match.matchType === 'group') {
        const winnerId = match.winner.toString();
        const team1Id = match.team1.toString();
        const team2Id = match.team2.toString();
        
        const winnerTeam = teams.find(t => t._id.toString() === winnerId);
        const loserId = winnerId === team1Id ? team2Id : team1Id;
        const loserTeam = teams.find(t => t._id.toString() === loserId);

        if (winnerTeam) {
          winnerTeam.matchesPlayed = (winnerTeam.matchesPlayed || 0) + 1;
          winnerTeam.matchesWon = (winnerTeam.matchesWon || 0) + 1;
          winnerTeam.points = (winnerTeam.points || 0) + 2;
          await winnerTeam.save();
        }

        if (loserTeam) {
          loserTeam.matchesPlayed = (loserTeam.matchesPlayed || 0) + 1;
          loserTeam.matchesLost = (loserTeam.matchesLost || 0) + 1;
          await loserTeam.save();
        }
      }
    }

    const updatedTeams = await Team.find({ tournament: tournamentId })
      .populate('players')
      .sort({ points: -1 });

    res.json({ message: 'Team statistics recalculated', teams: updatedTeams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete team
router.delete('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Remove team from tournament
    await Tournament.findByIdAndUpdate(team.tournament, {
      $pull: { teams: team._id }
    });

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
