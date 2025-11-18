# Net Run Rate (NRR) Calculation

## Formula

```
NRR = (Total Points Scored - Total Points Conceded) / Total Sets Played
```

## Explanation

### Components:

1. **Total Points Scored**: Sum of all points the team scored across all sets in all completed **group matches**
2. **Total Points Conceded**: Sum of all points the opponent scored against the team across all sets in all completed **group matches**
3. **Total Sets Played**: Total number of sets the team has played in all completed **group matches**

### Important Notes:

- **Only Group Matches**: NRR is calculated using only **group stage matches**. Semi-final and final matches do not affect NRR.
- **Only Completed Matches**: Only matches with `status === 'completed'` and with scores are included.
- **All Sets Count**: Every set played by the team is included in the calculation, regardless of whether the team won or lost the set.

## Example Calculation

### Example: Team A's NRR

**Match 1 (Group): Team A vs Team B**
- Set 1: A scored 11, B scored 9 → Points Scored: 11, Points Conceded: 9
- Set 2: A scored 8, B scored 11 → Points Scored: 8, Points Conceded: 11
- Set 3: A scored 11, B scored 7 → Points Scored: 11, Points Conceded: 7
- Set 4: A scored 11, B scored 5 → Points Scored: 11, Points Conceded: 5
- **Total from Match 1**: Scored = 41, Conceded = 32, Sets = 4

**Match 2 (Group): Team A vs Team C**
- Set 1: A scored 11, C scored 6 → Points Scored: 11, Points Conceded: 6
- Set 2: A scored 11, C scored 4 → Points Scored: 11, Points Conceded: 4
- Set 3: A scored 9, C scored 11 → Points Scored: 9, Points Conceded: 11
- **Total from Match 2**: Scored = 31, Conceded = 21, Sets = 3

**Total for Team A:**
- Total Points Scored = 41 + 31 = 72
- Total Points Conceded = 32 + 21 = 53
- Total Sets Played = 4 + 3 = 7
- **NRR = (72 - 53) / 7 = 19 / 7 = 2.71**

## Implementation

### Backend (`backend/routes/tournaments.js`)

```javascript
const calculateNRR = (teamId, matches) => {
  let totalPointsScored = 0;
  let totalPointsConceded = 0;
  let totalSetsPlayed = 0;

  matches.forEach(match => {
    // Only completed group matches with scores
    if (match.status !== 'completed' || !match.scores || !Array.isArray(match.scores)) {
      return;
    }

    // Check if team is in this match
    const team1Id = match.team1?._id ? match.team1._id.toString() : match.team1?.toString();
    const team2Id = match.team2?._id ? match.team2._id.toString() : match.team2?.toString();
    const isTeam1 = team1Id === teamId.toString();
    const isTeam2 = team2Id === teamId.toString();

    if (!isTeam1 && !isTeam2) {
      return;
    }

    // Sum points from all sets
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
```

### Frontend (`frontend/src/components/TournamentDetail.js`)

Same logic as backend, ensuring consistency.

## Usage in Tie-Breaking

When teams have the same number of points, NRR is used as the **primary tie-breaker**:

1. **Points** (Primary)
2. **NRR** (Tie-breaker 1) - Higher NRR ranks higher
3. **Number of Wins** (Tie-breaker 2)
4. **Win Percentage** (Tie-breaker 3)
5. **Fewer Losses** (Tie-breaker 4)
6. **Alphabetical Order** (Last resort)

## Display

- **Positive NRR** (e.g., +2.71): Team has scored more points than conceded (displayed in green)
- **Negative NRR** (e.g., -1.50): Team has conceded more points than scored (displayed in red)
- **Zero NRR** (0.00): Team has scored exactly as many points as conceded (displayed in gray)

## Notes

- NRR is calculated in real-time as matches are completed
- Only **group stage matches** affect NRR (semi-finals and finals are excluded)
- The calculation is consistent between frontend and backend
- NRR is displayed with 2 decimal places in the points table

