const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const requirePin = require('../middleware/requirePin');

// Helper function to calculate NRR (Net Run Rate)
const calculateNRR = (teamId, matches) => {
  let totalPointsScored = 0;
  let totalPointsConceded = 0;
  let totalSetsPlayed = 0;

  matches.forEach(match => {
    if (match.status !== 'completed' || !match.scores || !Array.isArray(match.scores)) {
      return;
    }

    const team1Id = match.team1?._id?.toString() || match.team1?.toString();
    const team2Id = match.team2?._id?.toString() || match.team2?.toString();
    const teamIdStr = teamId.toString();

    if (team1Id !== teamIdStr && team2Id !== teamIdStr) {
      return;
    }

    match.scores.forEach(score => {
      const team1Score = parseInt(score.team1Score) || 0;
      const team2Score = parseInt(score.team2Score) || 0;
      
      if (team1Id === teamIdStr) {
        totalPointsScored += team1Score;
        totalPointsConceded += team2Score;
      } else {
        totalPointsScored += team2Score;
        totalPointsConceded += team1Score;
      }
      totalSetsPlayed++;
    });
  });

  if (totalSetsPlayed === 0) return 0;
  return (totalPointsScored - totalPointsConceded) / totalSetsPlayed;
};

// Helper function to check if all group matches are completed
const areAllGroupMatchesCompleted = async (tournamentId) => {
  const allGroupMatches = await Match.find({
    tournament: tournamentId,
    matchType: 'group'
  });
  
  if (allGroupMatches.length === 0) return false;
  
  return allGroupMatches.every(match => match.status === 'completed' && match.winner);
};

// Helper function to generate semi-finals
const generateSemiFinals = async (tournamentId) => {
  try {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      console.error('Tournament not found for semi-final generation');
      return false;
    }

    const teams = await Team.find({ tournament: tournamentId });
    if (teams.length < 3) {
      console.log('Need at least 3 teams for semi-finals');
      return false;
    }

    // Check if semi-finals already exist
    const existingSemis = await Match.find({
      tournament: tournamentId,
      matchType: 'semifinal'
    });
    
    if (existingSemis.length > 0) {
      console.log('Semi-finals already exist, skipping generation');
      return false;
    }

    // Get all group matches for NRR calculation
    const allMatches = await Match.find({
      tournament: tournamentId,
      matchType: 'group'
    }).populate('team1').populate('team2');

    const matchesWithScores = allMatches.filter(m =>
      m.status === 'completed' &&
      m.scores &&
      Array.isArray(m.scores) &&
      m.scores.length > 0 &&
      m.matchType === 'group'
    );

    // Sort teams by points with tie-breaking
    const sortedTeams = [...teams].sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }

      const aNRR = calculateNRR(a._id, matchesWithScores);
      const bNRR = calculateNRR(b._id, matchesWithScores);
      if (Math.abs(bNRR - aNRR) > 0.001) {
        return bNRR - aNRR;
      }

      if ((b.matchesWon || 0) !== (a.matchesWon || 0)) {
        return (b.matchesWon || 0) - (a.matchesWon || 0);
      }

      return (a.matchesLost || 0) - (b.matchesLost || 0);
    });

    if (sortedTeams.length < 3) {
      console.log('Need at least 3 teams for semi-finals');
      return false;
    }

    // Semi-final 1: 1st vs 2nd
    const semiFinal1 = new Match({
      tournament: tournamentId,
      team1: sortedTeams[0]._id,
      team2: sortedTeams[1]._id,
      matchType: 'semifinal',
      status: 'scheduled'
    });
    await semiFinal1.save();

    // Semi-final 2: 3rd vs (will be updated with Semi 1 loser)
    const semiFinal2 = new Match({
      tournament: tournamentId,
      team1: sortedTeams[2]._id,
      team2: null,
      matchType: 'semifinal',
      status: 'scheduled'
    });
    await semiFinal2.save();

    tournament.semiFinalMatches = [semiFinal1._id, semiFinal2._id];
    await tournament.save();

    console.log(`✓ Auto-generated Semi-Final 1: ${sortedTeams[0].name} vs ${sortedTeams[1].name}`);
    console.log(`✓ Auto-generated Semi-Final 2: ${sortedTeams[2].name} vs (Semi 1 loser)`);
    return true;
  } catch (error) {
    console.error('Error generating semi-finals:', error);
    return false;
  }
};

// Helper function to update semi-final 2 with semi-final 1 loser
const updateSemiFinal2 = async (tournamentId) => {
  try {
    const tournament = await Tournament.findById(tournamentId)
      .populate({
        path: 'semiFinalMatches',
        populate: { path: 'team1 team2 winner' }
      });

    if (!tournament || !tournament.semiFinalMatches || tournament.semiFinalMatches.length < 2) {
      return false;
    }

    const semiFinal1 = tournament.semiFinalMatches[0];
    const semiFinal2 = tournament.semiFinalMatches[1];

    if (semiFinal1.status !== 'completed' || !semiFinal1.winner) {
      return false;
    }

    // If semi-final 2 already has team2, skip
    if (semiFinal2.team2) {
      return false;
    }

    // Get loser of Semi-final 1
    const winnerId = semiFinal1.winner?._id
      ? semiFinal1.winner._id.toString()
      : semiFinal1.winner?.toString();
    const team1Id = semiFinal1.team1?._id
      ? semiFinal1.team1._id.toString()
      : semiFinal1.team1?.toString();
    const team2Id = semiFinal1.team2?._id
      ? semiFinal1.team2._id.toString()
      : semiFinal1.team2?.toString();

    const loserId = winnerId === team1Id
      ? (semiFinal1.team2?._id || semiFinal1.team2)
      : (semiFinal1.team1?._id || semiFinal1.team1);

    semiFinal2.team2 = loserId;
    await semiFinal2.save();

    console.log(`✓ Auto-updated Semi-Final 2 with Semi 1 loser`);
    return true;
  } catch (error) {
    console.error('Error updating semi-final 2:', error);
    return false;
  }
};

// Helper function to generate final match
const generateFinal = async (tournamentId) => {
  try {
    const tournament = await Tournament.findById(tournamentId)
      .populate({
        path: 'semiFinalMatches',
        populate: { path: 'team1 team2 winner' }
      });

    if (!tournament || !tournament.semiFinalMatches || tournament.semiFinalMatches.length < 2) {
      return false;
    }

    // Check if final already exists
    if (tournament.finalMatch) {
      const finalMatch = await Match.findById(tournament.finalMatch);
      if (finalMatch) {
        console.log('Final match already exists, skipping generation');
        return false;
      }
    }

    const semiFinal1 = tournament.semiFinalMatches[0];
    const semiFinal2 = tournament.semiFinalMatches[1];

    if (semiFinal1.status !== 'completed' || semiFinal2.status !== 'completed') {
      return false;
    }

    if (!semiFinal1.winner || !semiFinal2.winner) {
      return false;
    }

    const finalMatch = new Match({
      tournament: tournamentId,
      team1: semiFinal1.winner._id || semiFinal1.winner,
      team2: semiFinal2.winner._id || semiFinal2.winner,
      matchType: 'final',
      status: 'scheduled'
    });

    await finalMatch.save();
    tournament.finalMatch = finalMatch._id;
    await tournament.save();

    console.log(`✓ Auto-generated Final match`);
    return true;
  } catch (error) {
    console.error('Error generating final:', error);
    return false;
  }
};

// Get all matches
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('tournament')
      .populate({
        path: 'team1',
        populate: { path: 'players' }
      })
      .populate({
        path: 'team2',
        populate: { path: 'players' }
      })
      .populate({
        path: 'winner',
        populate: { path: 'players' }
      })
      .populate('tossWinner')
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
      .populate('tossWinner')
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
      .populate('winner')
      .populate('tossWinner');
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
    ).populate('team1').populate('team2').populate('winner').populate('tossWinner');
    
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

      // Auto-generation logic based on match type
      const tournamentId = match.tournament.toString();
      
      if (match.matchType === 'group') {
        // Check if all group matches are completed, then generate semi-finals
        const allGroupCompleted = await areAllGroupMatchesCompleted(tournamentId);
        if (allGroupCompleted) {
          console.log('All group matches completed, auto-generating semi-finals...');
          await generateSemiFinals(tournamentId);
        }
      } else if (match.matchType === 'semifinal') {
        // Check if this is semi-final 1, then update semi-final 2
        const tournament = await Tournament.findById(tournamentId)
          .populate('semiFinalMatches');
        
        if (tournament && tournament.semiFinalMatches && tournament.semiFinalMatches.length >= 2) {
          const semi1Id = tournament.semiFinalMatches[0]._id.toString();
          const matchId = match._id.toString();
          
          if (semi1Id === matchId) {
            // Semi-Final 1 completed
            console.log('Semi-Final 1 completed, auto-updating Semi-Final 2...');
            await updateSemiFinal2(tournamentId);
            
            // After updating, check if semi-final 2 is also completed
            const updatedTournament = await Tournament.findById(tournamentId)
              .populate('semiFinalMatches');
            const semiFinal2 = updatedTournament.semiFinalMatches[1];
            if (semiFinal2.status === 'completed') {
              console.log('Both semi-finals completed, auto-generating final...');
              await generateFinal(tournamentId);
            }
          } else {
            // This is semi-final 2, check if both are completed to generate final
            const semiFinal1 = tournament.semiFinalMatches[0];
            const semiFinal2 = tournament.semiFinalMatches[1];
            
            if (semiFinal1.status === 'completed' && semiFinal2.status === 'completed') {
              console.log('Both semi-finals completed, auto-generating final...');
              await generateFinal(tournamentId);
            }
          }
        }
      }
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

      // Auto-generation logic based on match type
      const tournamentId = match.tournament.toString();
      
      if (match.matchType === 'group') {
        // Check if all group matches are completed, then generate semi-finals
        const allGroupCompleted = await areAllGroupMatchesCompleted(tournamentId);
        if (allGroupCompleted) {
          console.log('All group matches completed, auto-generating semi-finals...');
          await generateSemiFinals(tournamentId);
        }
      } else if (match.matchType === 'semifinal') {
        // Check if this is semi-final 1, then update semi-final 2
        const tournament = await Tournament.findById(tournamentId)
          .populate('semiFinalMatches');
        
        if (tournament && tournament.semiFinalMatches && tournament.semiFinalMatches.length >= 2) {
          const semi1Id = tournament.semiFinalMatches[0]._id.toString();
          const matchId = match._id.toString();
          
          if (semi1Id === matchId) {
            // Semi-Final 1 completed
            console.log('Semi-Final 1 completed, auto-updating Semi-Final 2...');
            await updateSemiFinal2(tournamentId);
            
            // After updating, check if semi-final 2 is also completed
            const updatedTournament = await Tournament.findById(tournamentId)
              .populate('semiFinalMatches');
            const semiFinal2 = updatedTournament.semiFinalMatches[1];
            if (semiFinal2.status === 'completed') {
              console.log('Both semi-finals completed, auto-generating final...');
              await generateFinal(tournamentId);
            }
          } else {
            // This is semi-final 2, check if both are completed to generate final
            const semiFinal1 = tournament.semiFinalMatches[0];
            const semiFinal2 = tournament.semiFinalMatches[1];
            
            if (semiFinal1.status === 'completed' && semiFinal2.status === 'completed') {
              console.log('Both semi-finals completed, auto-generating final...');
              await generateFinal(tournamentId);
            }
          }
        }
      }
    }

    // Reload match from database to ensure we have the latest data
    const populatedMatch = await Match.findById(match._id)
      .populate('team1')
      .populate('team2')
      .populate('winner')
      .populate('tossWinner');

    // Ensure scores are included in response
    if (!populatedMatch.scores) {
      populatedMatch.scores = [];
    }

    res.json(populatedMatch);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Perform toss for match
router.post('/:id/toss', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (!match.team1 || !match.team2) {
      return res.status(400).json({ error: 'Both teams must be assigned to perform toss' });
    }

    // Randomly determine toss winner (50/50 chance)
    const tossResult = Math.random() < 0.5 ? 'team1' : 'team2';
    const tossWinnerId = tossResult === 'team1' ? match.team1._id : match.team2._id;
    
    // Set toss winner
    match.tossWinner = tossWinnerId;
    
    await match.save();

    const populatedMatch = await Match.findById(match._id)
      .populate('tournament')
      .populate('team1')
      .populate('team2')
      .populate('tossWinner')
      .populate('winner');

    res.json(populatedMatch);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete match (PIN protected)
router.delete('/:id', requirePin, async (req, res) => {
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

