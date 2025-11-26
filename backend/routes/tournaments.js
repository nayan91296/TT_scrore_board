const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Match = require('../models/Match');
const requirePin = require('../middleware/requirePin');

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    let tournaments = await Tournament.find(query)
      .populate({
        path: 'teams',
        populate: { path: 'players' }
      })
      .populate('semiFinalMatches')
      .populate({
        path: 'finalMatch',
        populate: { path: 'team1 team2 winner' }
      })
      .populate('winner')
      .sort({ createdAt: -1 });
    
    // Manually populate winner's and runner-up's players if they exist
    tournaments = await Promise.all(tournaments.map(async (tournament) => {
      // Populate winner's players
      if (tournament.winner) {
        // Get the winner team ID - handle both ObjectId and string
        let winnerId;
        if (tournament.winner._id) {
          winnerId = tournament.winner._id.toString();
        } else if (typeof tournament.winner === 'string') {
          winnerId = tournament.winner;
        } else {
          winnerId = tournament.winner.toString();
        }
        
        // Always fetch fresh to ensure proper population
        const winnerTeam = await Team.findById(winnerId).populate('players');
        if (winnerTeam && winnerTeam.players) {
          // Check if players are populated (have name property)
          const hasPopulatedPlayers = winnerTeam.players.some(p => p && p.name);
          if (hasPopulatedPlayers) {
            // Convert to plain object to ensure proper serialization
            tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
          } else {
            // If still not populated, try again
            await winnerTeam.populate('players');
            tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
          }
        }
      }
      
      // Populate runner-up's players from final match
      if (tournament.finalMatch && tournament.finalMatch.team1 && tournament.finalMatch.team2 && tournament.winner) {
        const finalMatch = tournament.finalMatch;
        const winnerId = tournament.winner._id 
          ? tournament.winner._id.toString() 
          : (tournament.winner.toString ? tournament.winner.toString() : String(tournament.winner));
        
        // Get team1 and team2 IDs
        const team1Id = finalMatch.team1._id 
          ? finalMatch.team1._id.toString() 
          : (finalMatch.team1.toString ? finalMatch.team1.toString() : String(finalMatch.team1));
        const team2Id = finalMatch.team2._id 
          ? finalMatch.team2._id.toString() 
          : (finalMatch.team2.toString ? finalMatch.team2.toString() : String(finalMatch.team2));
        
        // Find the runner-up (the team that's not the winner)
        let runnerUpId = null;
        if (team1Id === winnerId) {
          runnerUpId = team2Id;
        } else if (team2Id === winnerId) {
          runnerUpId = team1Id;
        }
        
        // Populate runner-up team's players
        if (runnerUpId) {
          const runnerUpTeam = await Team.findById(runnerUpId).populate('players');
          if (runnerUpTeam && runnerUpTeam.players) {
            const hasPopulatedPlayers = runnerUpTeam.players.some(p => p && p.name);
            if (hasPopulatedPlayers) {
              // Update the finalMatch team reference with populated data
              if (team1Id === winnerId) {
                tournament.finalMatch.team2 = runnerUpTeam.toObject ? runnerUpTeam.toObject() : runnerUpTeam;
              } else {
                tournament.finalMatch.team1 = runnerUpTeam.toObject ? runnerUpTeam.toObject() : runnerUpTeam;
              }
            } else {
              await runnerUpTeam.populate('players');
              if (team1Id === winnerId) {
                tournament.finalMatch.team2 = runnerUpTeam.toObject ? runnerUpTeam.toObject() : runnerUpTeam;
              } else {
                tournament.finalMatch.team1 = runnerUpTeam.toObject ? runnerUpTeam.toObject() : runnerUpTeam;
              }
            }
          }
        }
      }
      
      return tournament;
    }));
    
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tournament history (completed tournaments)
router.get('/history', async (req, res) => {
  try {
    let tournaments = await Tournament.find({ status: 'completed' })
      .populate({
        path: 'teams',
        populate: { path: 'players' }
      })
      .populate('semiFinalMatches')
      .populate('finalMatch')
      .populate('winner')
      .sort({ endDate: -1 });
    
    // Manually populate winner's players if winner exists
    tournaments = await Promise.all(tournaments.map(async (tournament) => {
      if (tournament.winner) {
        // Get the winner team ID - handle both ObjectId and string
        let winnerId;
        if (tournament.winner._id) {
          winnerId = tournament.winner._id.toString();
        } else if (typeof tournament.winner === 'string') {
          winnerId = tournament.winner;
        } else {
          winnerId = tournament.winner.toString();
        }
        
        // Always fetch fresh to ensure proper population
        const winnerTeam = await Team.findById(winnerId).populate('players');
        if (winnerTeam && winnerTeam.players) {
          // Check if players are populated (have name property)
          const hasPopulatedPlayers = winnerTeam.players.some(p => p && p.name);
          if (hasPopulatedPlayers) {
            // Convert to plain object to ensure proper serialization
            tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
          } else {
            // If still not populated, try again
            await winnerTeam.populate('players');
            tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
          }
        }
      }
      return tournament;
    }));
    
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate all group matches (round-robin) for a tournament
// IMPORTANT: This route must be BEFORE /:id route to avoid route conflicts
router.post('/:id/generate-group-matches', async (req, res) => {
  console.log('=== Generate group matches route hit! ===');
  console.log('Tournament ID:', req.params.id);
  console.log('Request body:', req.body);
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('teams');

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.teams || tournament.teams.length < 2) {
      return res.status(400).json({ error: 'Tournament must have at least 2 teams to generate matches' });
    }

    // Check if group matches already exist
    const existingGroupMatches = await Match.find({ 
      tournament: tournament._id, 
      matchType: 'group' 
    });

    if (existingGroupMatches.length > 0) {
      // Option to delete existing matches or skip
      const { replace } = req.body;
      if (replace) {
        // Delete all existing group matches
        await Match.deleteMany({ 
          tournament: tournament._id, 
          matchType: 'group' 
        });
        console.log(`Deleted ${existingGroupMatches.length} existing group matches`);
      } else {
        return res.status(400).json({ 
          error: `Tournament already has ${existingGroupMatches.length} group match(es). Use replace=true to regenerate.`,
          existingMatches: existingGroupMatches.length
        });
      }
    }

    const teams = tournament.teams;
    const matchData = [];
    
    // Generate round-robin matches (each team plays every other team once)
    // First, create match data without saving
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matchData.push({
          tournament: tournament._id,
          team1: teams[i]._id,
          team2: teams[j]._id,
          matchType: 'group',
          status: 'scheduled'
        });
      }
    }

    // Shuffle matches using Fisher-Yates algorithm to avoid consecutive matches for same team
    const shuffleArray = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Function to count consecutive matches (same team playing back-to-back)
    const countConsecutiveMatches = (matchArray) => {
      let count = 0;
      for (let i = 1; i < matchArray.length; i++) {
        const prevMatch = matchArray[i - 1];
        const currentMatch = matchArray[i];
        // Check if same team appears in consecutive matches
        if (
          prevMatch.team1.toString() === currentMatch.team1.toString() ||
          prevMatch.team1.toString() === currentMatch.team2.toString() ||
          prevMatch.team2.toString() === currentMatch.team1.toString() ||
          prevMatch.team2.toString() === currentMatch.team2.toString()
        ) {
          count++;
        }
      }
      return count;
    };
    
    // Shuffle matches and optimize to minimize consecutive matches
    const shuffledMatchData = shuffleArray(matchData);
    
    // Additional optimization to minimize consecutive matches
    // Try multiple shuffles and pick the one with the fewest consecutive matches
    let bestMatchData = shuffledMatchData;
    let minConsecutiveMatches = countConsecutiveMatches(shuffledMatchData);
    const maxAttempts = 20;
    
    // Try to find the best shuffle (minimum consecutive matches)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = shuffleArray(matchData);
      const consecutiveCount = countConsecutiveMatches(candidate);
      
      if (consecutiveCount < minConsecutiveMatches) {
        bestMatchData = candidate;
        minConsecutiveMatches = consecutiveCount;
        
        // If we found a perfect shuffle (no consecutive matches), use it immediately
        if (consecutiveCount === 0) {
          break;
        }
      }
    }
    
    const finalMatchData = bestMatchData;
    
    console.log(`Match shuffling complete. Consecutive matches minimized to: ${minConsecutiveMatches} out of ${finalMatchData.length} total matches`);

    // Now save matches in shuffled order
    const matches = [];
    for (const matchDataItem of finalMatchData) {
      const match = new Match(matchDataItem);
      await match.save();
      matches.push(match);
    }

    // Populate matches with team data for response
    const populatedMatches = await Match.find({ 
      _id: { $in: matches.map(m => m._id) } 
    })
      .populate('team1')
      .populate('team2')
      .sort({ createdAt: 1 });

    const totalMatches = matches.length;
    console.log(`Generated ${totalMatches} group matches for tournament ${tournament.name}`);

    res.json({
      message: `Successfully generated ${totalMatches} group match(es)`,
      matches: populatedMatches,
      totalMatches: totalMatches,
      teamsCount: teams.length
    });
  } catch (error) {
    console.error('Error generating group matches:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single tournament
router.get('/:id', async (req, res) => {
  try {
    let tournament = await Tournament.findById(req.params.id)
      .populate({
        path: 'teams',
        populate: { path: 'players' }
      })
      .populate({
        path: 'semiFinalMatches',
        populate: { path: 'team1 team2 winner' }
      })
      .populate({
        path: 'finalMatch',
        populate: { path: 'team1 team2 winner' }
      })
      .populate('winner');
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Manually populate winner's players if winner exists
    if (tournament.winner) {
      // Get the winner team ID - handle both ObjectId and string
      let winnerId;
      if (tournament.winner._id) {
        winnerId = tournament.winner._id.toString();
      } else if (typeof tournament.winner === 'string') {
        winnerId = tournament.winner;
      } else {
        winnerId = tournament.winner.toString();
      }
      
      // Always fetch fresh to ensure proper population
      const winnerTeam = await Team.findById(winnerId).populate('players');
      if (winnerTeam && winnerTeam.players) {
        // Check if players are populated (have name property)
        const hasPopulatedPlayers = winnerTeam.players.some(p => p && p.name);
        if (hasPopulatedPlayers) {
          // Convert to plain object to ensure proper serialization
          tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
        } else {
          // If still not populated, try again
          await winnerTeam.populate('players');
          tournament.winner = winnerTeam.toObject ? winnerTeam.toObject() : winnerTeam;
        }
      }
    }
    
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tournament
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }
    if (!req.body.startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }
    if (!req.body.endDate) {
      return res.status(400).json({ error: 'End date is required' });
    }

    // Convert date strings to Date objects if needed
    const tournamentData = {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate)
    };

    // Validate dates
    if (isNaN(tournamentData.startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start date' });
    }
    if (isNaN(tournamentData.endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }

    const tournament = new Tournament(tournamentData);
    await tournament.save();
    res.status(201).json(tournament);
  } catch (error) {
    console.error('Tournament creation error:', error);
    res.status(400).json({ error: error.message || 'Failed to create tournament' });
  }
});

// Update tournament (PIN protected – used for status/winner updates from UI)
router.put('/:id', requirePin, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('teams')
      .populate('semiFinalMatches')
      .populate('finalMatch')
      .populate('winner');
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Log winner update for debugging
    if (req.body.winner) {
      console.log(`Tournament ${tournament.name} winner updated to: ${req.body.winner}`);
    }
    
    res.json(tournament);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete tournament (PIN protected)
router.delete('/:id', requirePin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // First, find all teams associated with this tournament to verify
    // Try multiple query formats to ensure we catch all teams
    const teamsToDelete1 = await Team.find({ tournament: tournament._id });
    const teamsToDelete2 = await Team.find({ tournament: tournament._id.toString() });
    const allTeamsToDelete = [...teamsToDelete1, ...teamsToDelete2.filter(t => 
      !teamsToDelete1.some(t1 => t1._id.toString() === t._id.toString())
    )];
    
    console.log(`Found ${allTeamsToDelete.length} team(s) associated with tournament ${tournament.name} (ID: ${tournament._id})`);
    console.log(`Query 1 (ObjectId): ${teamsToDelete1.length} teams, Query 2 (String): ${teamsToDelete2.length} teams`);
    
    if (allTeamsToDelete.length > 0) {
      console.log('Teams to delete:', allTeamsToDelete.map(t => ({ 
        id: t._id, 
        name: t.name, 
        tournament: t.tournament,
        tournamentType: typeof t.tournament
      })));
    }
    
    // Delete all teams associated with this tournament
    // Delete by ObjectId first
    let teamsDeleted = await Team.deleteMany({ tournament: tournament._id });
    // If no teams deleted, try with string
    if (teamsDeleted.deletedCount === 0) {
      teamsDeleted = await Team.deleteMany({ tournament: tournament._id.toString() });
    }
    // Also try deleting by team IDs directly if found
    if (allTeamsToDelete.length > 0 && teamsDeleted.deletedCount === 0) {
      const teamIds = allTeamsToDelete.map(t => t._id);
      teamsDeleted = await Team.deleteMany({ _id: { $in: teamIds } });
    }
    
    console.log(`Deleted ${teamsDeleted.deletedCount} team(s) associated with tournament ${tournament.name}`);

    // Find all matches associated with this tournament
    const matchesToDelete = await Match.find({ tournament: tournament._id });
    console.log(`Found ${matchesToDelete.length} match(es) associated with tournament ${tournament.name}`);
    
    // Delete all matches associated with this tournament
    const matchesDeleted = await Match.deleteMany({ tournament: tournament._id });
    console.log(`Deleted ${matchesDeleted.deletedCount} match(es) associated with tournament ${tournament.name}`);

    // Delete the tournament itself
    await Tournament.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: 'Tournament deleted successfully',
      teamsDeleted: teamsDeleted.deletedCount,
      matchesDeleted: matchesDeleted.deletedCount
    });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate NRR for a team (matching frontend logic exactly)
const calculateNRR = (teamId, matches) => {
  let totalPointsScored = 0;
  let totalPointsConceded = 0;
  let totalSetsPlayed = 0;

  matches.forEach(match => {
    // Frontend filters to completed matches with scores
    if (match.status !== 'completed' || !match.scores || !Array.isArray(match.scores)) {
      return;
    }

    // Handle both ObjectId and populated object cases (matching frontend logic)
    const team1Id = match.team1?._id ? match.team1._id.toString() : match.team1?.toString();
    const team2Id = match.team2?._id ? match.team2._id.toString() : match.team2?.toString();
    const isTeam1 = team1Id === teamId.toString();
    const isTeam2 = team2Id === teamId.toString();

    if (!isTeam1 && !isTeam2) {
      return;
    }

    match.scores.forEach(score => {
      const team1Score = parseInt(score.team1Score) || 0;
      const team2Score = parseInt(score.team2Score) || 0;

      if (isTeam1) {
        totalPointsScored += team1Score;
        totalPointsConceded += team2Score;
      } else if (isTeam2) {
        totalPointsScored += team2Score;
        totalPointsConceded += team1Score;
      }
      totalSetsPlayed++;
    });
  });

  if (totalSetsPlayed === 0) {
    return 0;
  }

  return (totalPointsScored - totalPointsConceded) / totalSetsPlayed;
};

// Generate semi-finals (Top 3 teams: Semi 1: 1st vs 2nd, Semi 2: 3rd vs Semi 1 loser)
router.post('/:id/semifinals', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get fresh team data with latest stats
    const teams = await Team.find({ tournament: tournament._id });
    
    if (teams.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 teams for semi-finals' });
    }

    // Delete ALL existing semi-final matches for this tournament
    const deletedCount = await Match.deleteMany({ 
      tournament: tournament._id, 
      matchType: 'semifinal' 
    });
    console.log(`Deleted ${deletedCount.deletedCount} existing semi-final matches`);
    tournament.semiFinalMatches = [];
    await tournament.save();
    console.log('Tournament semiFinalMatches array cleared');

    // Get only GROUP matches for NRR calculation (points table only uses group matches)
    const allMatches = await Match.find({ 
      tournament: tournament._id,
      matchType: 'group'  // Only group matches for points table
    }).populate('team1').populate('team2');
    
    // Filter to only completed group matches with scores (matching frontend calculateNRR logic exactly)
    const matchesWithScores = allMatches.filter(m => 
      m.status === 'completed' && 
      m.scores && 
      Array.isArray(m.scores) && 
      m.scores.length > 0 &&
      m.matchType === 'group'  // Double-check: only group matches
    );

    // Log all teams before sorting
    console.log('=== All teams before sorting ===');
    teams.forEach(team => {
      const nrr = calculateNRR(team._id, matchesWithScores);
      console.log(`Team: ${team.name}, Points: ${team.points}, NRR: ${nrr.toFixed(2)}, Wins: ${team.matchesWon}, Losses: ${team.matchesLost}, ID: ${team._id}`);
    });
    
    // Sort teams by points with tie-breaking (matching frontend logic exactly)
    // Create a copy to avoid mutating the original array
    const sortedTeams = [...teams].sort((a, b) => {
      // 1. Primary: Points (descending)
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }
      
      // 2. Tie-breaker 1: Net Run Rate (NRR) - Higher NRR ranks higher
      // Use matchesWithScores (all matches with scores, not just completed)
      const aNRR = calculateNRR(a._id, matchesWithScores);
      const bNRR = calculateNRR(b._id, matchesWithScores);
      console.log(`Comparing ${a.name} (Points: ${a.points}, NRR: ${aNRR.toFixed(2)}) vs ${b.name} (Points: ${b.points}, NRR: ${bNRR.toFixed(2)})`);
      if (Math.abs(bNRR - aNRR) > 0.001) { // Use small epsilon for float comparison
        return bNRR - aNRR;
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
      
      // 6. Tie-breaker 5: Head-to-head record
      const h2hMatches = matchesWithScores.filter(match => 
        match.status === 'completed' &&
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
      
      // 7. Last resort: Alphabetical
      return a.name.localeCompare(b.name);
    });
    
    // Log sorted teams for debugging
    console.log('=== Sorted teams for semi-finals (matching frontend points table) ===');
    sortedTeams.forEach((team, index) => {
      const nrr = calculateNRR(team._id, matchesWithScores);
      console.log(`${index + 1}. ${team.name} (ID: ${team._id}) - Points: ${team.points}, NRR: ${nrr.toFixed(2)}, Wins: ${team.matchesWon}, Losses: ${team.matchesLost}`);
    });
    console.log('========================================');
    
    // Check for ties in top 3 positions and log warning
    const top3 = sortedTeams.slice(0, 3);
    for (let i = 0; i < top3.length - 1; i++) {
      const team = top3[i];
      const nextTeam = top3[i + 1];
      const teamNRR = calculateNRR(team._id, matchesWithScores);
      const nextNRR = calculateNRR(nextTeam._id, matchesWithScores);
      
      if (team.points === nextTeam.points && 
          Math.abs(teamNRR - nextNRR) < 0.001 &&
          team.matchesWon === nextTeam.matchesWon &&
          team.matchesLost === nextTeam.matchesLost) {
        // Check head-to-head
        const h2hMatches = matchesWithScores.filter(match => 
          match.status === 'completed' &&
          match.winner &&
          ((match.team1?._id?.toString() === team._id.toString() && match.team2?._id?.toString() === nextTeam._id.toString()) ||
           (match.team1?._id?.toString() === nextTeam._id.toString() && match.team2?._id?.toString() === team._id.toString()))
        );
        let h2hTied = true;
        if (h2hMatches.length > 0) {
          let teamWins = 0, nextWins = 0;
          h2hMatches.forEach(match => {
            const winnerId = match.winner?._id?.toString();
            if (winnerId === team._id.toString()) teamWins++;
            else if (winnerId === nextTeam._id.toString()) nextWins++;
          });
          h2hTied = (teamWins === nextWins);
        }
        
        if (h2hTied) {
          console.log(`⚠️ WARNING: Teams ${team.name} and ${nextTeam.name} are tied at position ${i + 1}/${i + 2} after all tie-breakers (including head-to-head). Ranking by alphabetical order.`);
        }
      }
    }
    
    // Verify we have the correct teams for semi-finals
    if (sortedTeams.length >= 3) {
      console.log('Teams for Semi-Finals:');
      console.log(`  Semi-Final 1: ${sortedTeams[0].name} (1st) vs ${sortedTeams[1].name} (2nd)`);
      console.log(`  Semi-Final 2: ${sortedTeams[2].name} (3rd) vs (Semi 1 Loser)`);
      console.log(`  VERIFY: Index 2 (3rd place) = ${sortedTeams[2].name}, Index 3 (4th place) = ${sortedTeams[3]?.name || 'N/A'}`);
    }
    
    // Verify we have at least 2 teams
    if (sortedTeams.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 teams for semi-finals' });
    }
    
    // Semi-final 1: 1st place vs 2nd place
    const team1Id = sortedTeams[0]._id;
    const team2Id = sortedTeams[1]._id;
    
    console.log(`Creating Semi-Final 1:`);
    console.log(`  Team 1: ${sortedTeams[0].name} (ID: ${team1Id})`);
    console.log(`  Team 2: ${sortedTeams[1].name} (ID: ${team2Id})`);
    
    const semiFinal1 = new Match({
      tournament: tournament._id,
      team1: team1Id,  // 1st place
      team2: team2Id,  // 2nd place
      matchType: 'semifinal',
      status: 'scheduled'
    });

    await semiFinal1.save();
    
    // Verify the match was created correctly
    const savedSemiFinal1 = await Match.findById(semiFinal1._id)
      .populate('team1')
      .populate('team2');
    console.log(`✓ Semi-Final 1 saved: ${savedSemiFinal1.team1?.name} vs ${savedSemiFinal1.team2?.name}`);

    // Semi-final 2: 3rd place vs (will be updated with Semi 1 loser after Semi 1 completes)
    if (sortedTeams.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 teams for semi-finals' });
    }
    
    // IMPORTANT: Use index 2 for 3rd place (0-indexed: 0=1st, 1=2nd, 2=3rd)
    const team3Id = sortedTeams[2]._id;  // 3rd place
    console.log(`Creating Semi-Final 2:`);
    console.log(`  Team 1 (3rd place from sortedTeams[2]): ${sortedTeams[2].name} (ID: ${team3Id})`);
    console.log(`  VERIFY: sortedTeams[2] = ${sortedTeams[2].name}, sortedTeams[3] = ${sortedTeams[3]?.name || 'N/A'}`);
    console.log(`  Team 2: null (will be set to Semi 1 loser)`);
    
    const semiFinal2 = new Match({
      tournament: tournament._id,
      team1: team3Id,  // 3rd place
      team2: null,  // Will be set to Semi 1 loser after Semi 1 completes
      matchType: 'semifinal',
      status: 'scheduled'
    });

    await semiFinal2.save();
    
    // Verify the match was created correctly
    const savedSemiFinal2 = await Match.findById(semiFinal2._id)
      .populate('team1')
      .populate('team2');
    console.log(`✓ Semi-Final 2 saved: ${savedSemiFinal2.team1?.name} (ID: ${savedSemiFinal2.team1?._id}) vs (TBD)`);
    
    // Double-check the team is correct
    if (savedSemiFinal2.team1?._id?.toString() !== team3Id.toString()) {
      console.error(`ERROR: Semi-Final 2 team1 mismatch! Expected: ${team3Id}, Got: ${savedSemiFinal2.team1?._id}`);
    }

    // Populate team names for response
    const populatedSemiFinal1 = await Match.findById(semiFinal1._id)
      .populate('team1')
      .populate('team2');
    const populatedSemiFinal2 = await Match.findById(semiFinal2._id)
      .populate('team1')
      .populate('team2');

    tournament.semiFinalMatches = [semiFinal1._id, semiFinal2._id];
    await tournament.save();

    const responseMessage = `Semi-final 1: ${sortedTeams[0].name} vs ${sortedTeams[1].name}. Semi-final 2: ${sortedTeams[2].name} vs (Semi 1 loser)`;
    console.log('Semi-finals created:', responseMessage);
    console.log('Semi-Final 1 teams:', populatedSemiFinal1.team1?.name, 'vs', populatedSemiFinal1.team2?.name);
    console.log('Semi-Final 2 teams:', populatedSemiFinal2.team1?.name, 'vs', populatedSemiFinal2.team2?.name || '(TBD)');

    res.json({
      tournament,
      semiFinals: [populatedSemiFinal1, populatedSemiFinal2],
      message: responseMessage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Semi-final 2 with Semi-final 1 loser
router.post('/:id/update-semifinal2', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate({
        path: 'semiFinalMatches',
        populate: { path: 'team1 team2 winner' }
      });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.semiFinalMatches || tournament.semiFinalMatches.length < 2) {
      return res.status(400).json({ error: 'Both semi-finals must exist' });
    }

    const semiFinal1 = tournament.semiFinalMatches[0];
    const semiFinal2 = tournament.semiFinalMatches[1];

    if (semiFinal1.status !== 'completed') {
      return res.status(400).json({ error: 'Semi-final 1 must be completed first' });
    }

    if (!semiFinal1.winner) {
      return res.status(400).json({ error: 'Semi-final 1 must have a winner' });
    }

    // Get loser of Semi-final 1
    // Handle both ObjectId and populated object cases
    const winnerId = semiFinal1.winner?._id 
      ? semiFinal1.winner._id.toString() 
      : semiFinal1.winner?.toString();
    const team1Id = semiFinal1.team1?._id 
      ? semiFinal1.team1._id.toString() 
      : semiFinal1.team1?.toString();
    const team2Id = semiFinal1.team2?._id 
      ? semiFinal1.team2._id.toString() 
      : semiFinal1.team2?.toString();
    
    console.log('Determining Semi-Final 1 loser:');
    console.log(`  Winner ID: ${winnerId}`);
    console.log(`  Team 1 ID: ${team1Id}`);
    console.log(`  Team 2 ID: ${team2Id}`);
    
    const loserId = winnerId === team1Id 
      ? (semiFinal1.team2?._id || semiFinal1.team2)
      : (semiFinal1.team1?._id || semiFinal1.team1);
    
    console.log(`  Loser ID: ${loserId}`);
    console.log(`  Loser: ${semiFinal1.team1?._id?.toString() === loserId?.toString() ? semiFinal1.team1?.name : semiFinal1.team2?.name}`);

    // Update Semi-final 2 with Semi-final 1 loser
    semiFinal2.team2 = loserId;
    await semiFinal2.save();
    
    console.log(`Updated Semi-Final 2: ${semiFinal2.team1?.name || 'Team 1'} vs ${loserId}`);

    // Reload with populated data
    const updatedSemiFinal2 = await Match.findById(semiFinal2._id)
      .populate('team1')
      .populate('team2')
      .populate('winner');

    res.json({
      tournament,
      semiFinal2: updatedSemiFinal2,
      message: `Semi-final 2 updated: ${updatedSemiFinal2.team1?.name} vs ${updatedSemiFinal2.team2?.name}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate final (Semi-final 1 winner vs Semi-final 2 winner)
router.post('/:id/final', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('teams')
      .populate({
        path: 'semiFinalMatches',
        populate: { path: 'team1 team2 winner' }
      });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.semiFinalMatches || tournament.semiFinalMatches.length < 2) {
      return res.status(400).json({ error: 'Both semi-finals must be completed first' });
    }

    const semiFinal1 = tournament.semiFinalMatches[0];
    const semiFinal2 = tournament.semiFinalMatches[1];

    if (semiFinal1.status !== 'completed' || semiFinal2.status !== 'completed') {
      return res.status(400).json({ error: 'Both semi-finals must be completed' });
    }

    if (!semiFinal1.winner || !semiFinal2.winner) {
      return res.status(400).json({ error: 'Both semi-finals must have winners' });
    }

    const finalMatch = new Match({
      tournament: tournament._id,
      team1: semiFinal1.winner._id,  // Semi-final 1 winner
      team2: semiFinal2.winner._id,  // Semi-final 2 winner
      matchType: 'final',
      status: 'scheduled'
    });

    await finalMatch.save();

    tournament.finalMatch = finalMatch._id;
    await tournament.save();

    res.json({
      tournament,
      final: finalMatch,
      message: `Final: ${semiFinal1.winner.name} (Semi 1 winner) vs ${semiFinal2.winner.name} (Semi 2 winner)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

