const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');

// Get all matches
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('tournament')
      .populate('team1')
      .populate('team2')
      .populate('winner')
      .sort({ matchDate: -1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches by tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const matches = await Match.find({ tournament: req.params.tournamentId })
      .populate({
        path: 'team1',
        populate: { path: 'players' }
      })
      .populate({
        path: 'team2',
        populate: { path: 'players' }
      })
      .populate('winner')
      .sort({ matchType: 1, matchDate: -1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single match
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('tournament')
      .populate({
        path: 'team1',
        populate: { path: 'players' }
      })
      .populate({
        path: 'team2',
        populate: { path: 'players' }
      })
      .populate('winner');
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create match
router.post('/', async (req, res) => {
  try {
    const match = new Match(req.body);
    await match.save();
    
    const populatedMatch = await Match.findById(match._id)
      .populate('tournament')
      .populate('team1')
      .populate('team2')
      .populate('winner');
    
    res.status(201).json(populatedMatch);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update match
router.put('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // If match is being marked as completed, update team stats (only for group matches)
    if (req.body.status === 'completed' && match.status !== 'completed' && req.body.winner) {
      // Only update team statistics for GROUP matches (not semi-final or final)
      if (match.matchType === 'group') {
        const winnerId = req.body.winner.toString();
        const team1Id = match.team1.toString();
        const team2Id = match.team2 ? match.team2.toString() : null;
        
        if (!team2Id) {
          return res.status(400).json({ error: 'Match must have both teams to complete' });
        }
        
        const winnerTeam = await Team.findById(winnerId);
        const loserId = winnerId === team1Id ? team2Id : team1Id;
        const loserTeam = await Team.findById(loserId);
        
        console.log(`Updating stats for group match completion:`);
        console.log(`Winner ID: ${winnerId}, Loser ID: ${loserId}`);
        console.log(`Winner Team: ${winnerTeam?.name}, Loser Team: ${loserTeam?.name}`);
        
        if (winnerTeam) {
          winnerTeam.matchesPlayed = (winnerTeam.matchesPlayed || 0) + 1;
          winnerTeam.matchesWon = (winnerTeam.matchesWon || 0) + 1;
          winnerTeam.points = (winnerTeam.points || 0) + 2;
          await winnerTeam.save();
          console.log(`Updated winner: ${winnerTeam.name} - Points: ${winnerTeam.points}, Won: ${winnerTeam.matchesWon}`);
        } else {
          console.error(`Winner team not found: ${winnerId}`);
        }
        
        if (loserTeam) {
          loserTeam.matchesPlayed = (loserTeam.matchesPlayed || 0) + 1;
          loserTeam.matchesLost = (loserTeam.matchesLost || 0) + 1;
          await loserTeam.save();
          console.log(`Updated loser: ${loserTeam.name} - Lost: ${loserTeam.matchesLost}`);
        } else {
          console.error(`Loser team not found: ${loserId}`);
        }
      } else {
        console.log(`Match ${match.matchType} completed - skipping team stats update (only group matches affect points table)`);
      }
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('team1').populate('team2').populate('winner');
    
    // If match was completed, handle tournament status update for finals
    if (req.body.status === 'completed' && req.body.winner && match.matchType === 'final') {
      const tournament = await Tournament.findById(match.tournament);
      if (tournament) {
        tournament.winner = req.body.winner;
        tournament.status = 'completed';
        await tournament.save();
        console.log(`Tournament ${tournament.name} marked as completed. Winner: ${req.body.winner}`);
      }
    }
    
    // Also check if the updated match is a completed final (in case winner was set via score endpoint)
    if (updatedMatch && updatedMatch.status === 'completed' && updatedMatch.winner && updatedMatch.matchType === 'final') {
      const tournament = await Tournament.findById(updatedMatch.tournament);
      if (tournament && !tournament.winner) {
        tournament.winner = updatedMatch.winner;
        tournament.status = 'completed';
        await tournament.save();
        console.log(`Tournament ${tournament.name} winner set from final match: ${updatedMatch.winner}`);
      }
    }
    
    // If match was completed, reload teams to verify stats were updated
    if (req.body.status === 'completed') {
      const winnerTeam = await Team.findById(req.body.winner);
      const team1Id = match.team1.toString();
      const team2Id = match.team2 ? match.team2.toString() : null;
      const loserId = req.body.winner.toString() === team1Id ? team2Id : team1Id;
      const loserTeam = await Team.findById(loserId);
      
      console.log('Verification after match completion:');
      console.log(`Winner ${winnerTeam?.name}: Points=${winnerTeam?.points}, Won=${winnerTeam?.matchesWon}, Played=${winnerTeam?.matchesPlayed}`);
      console.log(`Loser ${loserTeam?.name}: Lost=${loserTeam?.matchesLost}, Played=${loserTeam?.matchesPlayed}`);
    }
    
    res.json(updatedMatch);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add score to match
router.post('/:id/score', async (req, res) => {
  try {
    const { setNumber, team1Score, team2Score } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Ensure scores array exists
    if (!match.scores) {
      match.scores = [];
    }

    // Update match status to in-progress if it's scheduled
    if (match.status === 'scheduled') {
      match.status = 'in-progress';
    }

    // Parse scores as numbers
    const parsedTeam1Score = parseInt(team1Score) || 0;
    const parsedTeam2Score = parseInt(team2Score) || 0;

    // Check if set already exists
    const existingSetIndex = match.scores.findIndex(s => s.setNumber === parseInt(setNumber));
    if (existingSetIndex >= 0) {
      match.scores[existingSetIndex].team1Score = parsedTeam1Score;
      match.scores[existingSetIndex].team2Score = parsedTeam2Score;
    } else {
      match.scores.push({ 
        setNumber: parseInt(setNumber), 
        team1Score: parsedTeam1Score, 
        team2Score: parsedTeam2Score 
      });
    }

    // Sort scores by set number
    match.scores.sort((a, b) => a.setNumber - b.setNumber);

    // Mark scores array as modified
    match.markModified('scores');
    await match.save();

    // Determine winner if all sets are played (best of 5 or 7)
    const totalSets = match.scores.length;
    let team1Wins = 0;
    let team2Wins = 0;

    match.scores.forEach(score => {
      const team1Score = parseInt(score.team1Score) || 0;
      const team2Score = parseInt(score.team2Score) || 0;
      if (team1Score > team2Score) {
        team1Wins++;
      } else if (team2Score > team1Score) {
        team2Wins++;
      }
    });

    // Best of 5 sets (first to 3)
    const isMatchCompleted = totalSets >= 3 && (team1Wins >= 3 || team2Wins >= 3);
    
    // Only update stats if match is newly completed (wasn't completed before)
    if (isMatchCompleted && match.status !== 'completed') {
      match.status = 'completed';
      match.winner = team1Wins > team2Wins ? match.team1 : match.team2;
      
      // Only update team statistics for GROUP matches (not semi-final or final)
      if (match.matchType === 'group') {
        // Update team statistics - ensure we use ObjectId comparison
        const winnerId = match.winner.toString();
        const team1Id = match.team1.toString();
        const team2Id = match.team2.toString();
        
        const winnerTeam = await Team.findById(winnerId);
        const loserId = winnerId === team1Id ? team2Id : team1Id;
        const loserTeam = await Team.findById(loserId);
        
        if (winnerTeam) {
          winnerTeam.matchesPlayed = (winnerTeam.matchesPlayed || 0) + 1;
          winnerTeam.matchesWon = (winnerTeam.matchesWon || 0) + 1;
          winnerTeam.points = (winnerTeam.points || 0) + 2;
          await winnerTeam.save();
          console.log(`Updated winner team ${winnerTeam.name}: ${winnerTeam.points} points (Group match)`);
        }
        
        if (loserTeam) {
          loserTeam.matchesPlayed = (loserTeam.matchesPlayed || 0) + 1;
          loserTeam.matchesLost = (loserTeam.matchesLost || 0) + 1;
          await loserTeam.save();
          console.log(`Updated loser team ${loserTeam.name}: ${loserTeam.points} points (Group match)`);
        }
      } else {
        console.log(`Match ${match.matchType} completed - skipping team stats update (only group matches affect points table)`);
      }

      // If this is a final, update tournament winner
      if (match.matchType === 'final') {
        const tournament = await Tournament.findById(match.tournament);
        if (tournament) {
          tournament.winner = match.winner;
          tournament.status = 'completed';
          await tournament.save();
          console.log(`Tournament ${tournament.name} winner set to: ${match.winner} (from final match)`);
        }
      }
      
      // Save match with winner
      await match.save();
    }

    // Reload match from database to ensure we have the latest data
    const populatedMatch = await Match.findById(match._id)
      .populate('team1')
      .populate('team2')
      .populate('winner');

    // Ensure scores are included in response
    if (!populatedMatch.scores) {
      populatedMatch.scores = [];
    }

    res.json(populatedMatch);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete match
router.delete('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // If match was completed and was a group match, we need to update team stats
    if (match.status === 'completed' && match.matchType === 'group' && match.winner && match.team1 && match.team2) {
      const winnerId = match.winner.toString();
      const team1Id = match.team1.toString();
      const team2Id = match.team2.toString();
      
      const winnerTeam = await Team.findById(winnerId);
      const loserId = winnerId === team1Id ? team2Id : team1Id;
      const loserTeam = await Team.findById(loserId);
      
      // Decrement stats for winner team
      if (winnerTeam) {
        winnerTeam.matchesPlayed = Math.max(0, (winnerTeam.matchesPlayed || 0) - 1);
        winnerTeam.matchesWon = Math.max(0, (winnerTeam.matchesWon || 0) - 1);
        winnerTeam.points = Math.max(0, (winnerTeam.points || 0) - 2);
        await winnerTeam.save();
      }
      
      // Decrement stats for loser team
      if (loserTeam) {
        loserTeam.matchesPlayed = Math.max(0, (loserTeam.matchesPlayed || 0) - 1);
        loserTeam.matchesLost = Math.max(0, (loserTeam.matchesLost || 0) - 1);
        await loserTeam.save();
      }
    }

    // Handle tournament updates (winner, status, and match references)
    const tournament = await Tournament.findById(match.tournament);
    if (tournament) {
      // If this was a final match, check if we need to clear tournament winner
      if (match.matchType === 'final' && match.status === 'completed') {
        if (tournament.winner && tournament.winner.toString() === match.winner.toString()) {
          // Clear tournament winner if this was the final that determined it
          tournament.winner = undefined;
          // Only change status if it was completed due to this match
          if (tournament.status === 'completed') {
            tournament.status = 'ongoing';
          }
        }
      }

      // Remove match from tournament's semiFinalMatches or finalMatch if applicable
      if (match.matchType === 'semifinal') {
        tournament.semiFinalMatches = tournament.semiFinalMatches.filter(
          id => id.toString() !== match._id.toString()
        );
      } else if (match.matchType === 'final') {
        tournament.finalMatch = undefined;
      }
      await tournament.save();
    }

    // Delete the match
    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

