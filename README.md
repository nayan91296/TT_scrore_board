# 🏓 Table Tennis Tournament Manager

A full-stack application for managing table tennis tournaments with support for players, teams, matches, and tournament brackets (semi-finals and finals).

## Features

- ✅ **Tournament Management**: Create and manage tournaments
- ✅ **Player Management**: Add and manage players with ratings
- ✅ **Team Management**: Create teams by selecting players
- ✅ **Match Management**: Create matches and track scores
- ✅ **Semi-Finals & Finals**: Automatic bracket generation and scorecard management
- ✅ **Score Tracking**: Track scores set by set
- ✅ **Leaderboard**: View team standings with points

## Tech Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Frontend**: React, React Router, Axios
- **Database**: MongoDB

## Project Structure

```
tt-tournament-manager/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── server.js        # Express server
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API service
│   │   └── App.js
│   └── package.json
└── package.json         # Root package.json
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- npm or yarn

## Installation

1. **Clone or navigate to the project directory**

2. **Install all dependencies** (root, backend, and frontend):
   ```bash
   npm run install-all
   ```

   Or install manually:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Set up MongoDB**

   - Make sure MongoDB is running on your system
   - Default connection: `mongodb://localhost:27017/tt-tournament`
   - Or create a `.env` file in the `backend` folder:
     ```
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/tt-tournament
     ```

## Running the Application

### Option 1: Run both servers together (recommended)
```bash
npm run dev
```

### Option 2: Run servers separately

**Terminal 1 - Backend:**
```bash
npm run server
# or
cd backend && npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run client
# or
cd frontend && npm start
```

- Backend API: http://localhost:5000
- Frontend App: http://localhost:3000

## Usage Guide

### 1. Create Players
- Navigate to "Players" page
- Click "Add Player"
- Fill in player details (name, email, phone, rating)

### 2. Create Tournament
- Navigate to "Tournaments" page
- Click "Add Tournament"
- Fill in tournament details (name, dates, description)

### 3. Create Teams
- Navigate to "Teams" page
- Click "Create Team"
- Select tournament and players for the team

### 4. Manage Matches
- Go to a tournament detail page
- Create matches manually or generate semi-finals automatically
- Add scores set by set
- System automatically determines winners (best of 5 sets)

### 5. Generate Semi-Finals
- Ensure at least 4 teams are in the tournament
- Click "Generate Semi-Finals" button
- System creates matches for top 4 teams based on points

### 6. Generate Final
- Complete both semi-final matches
- Click "Generate Final" button
- System creates final match between semi-final winners

## API Endpoints

### Tournaments
- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments/:id` - Get single tournament
- `POST /api/tournaments` - Create tournament
- `PUT /api/tournaments/:id` - Update tournament
- `DELETE /api/tournaments/:id` - Delete tournament
- `POST /api/tournaments/:id/semifinals` - Generate semi-finals
- `POST /api/tournaments/:id/final` - Generate final

### Players
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get single player
- `POST /api/players` - Create player
- `PUT /api/players/:id` - Update player
- `DELETE /api/players/:id` - Delete player

### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/tournament/:tournamentId` - Get teams by tournament
- `GET /api/teams/:id` - Get single team
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### Matches
- `GET /api/matches` - Get all matches
- `GET /api/matches/tournament/:tournamentId` - Get matches by tournament
- `GET /api/matches/:id` - Get single match
- `POST /api/matches` - Create match
- `PUT /api/matches/:id` - Update match
- `POST /api/matches/:id/score` - Add score to match
- `DELETE /api/matches/:id` - Delete match

## Development

- Backend uses `nodemon` for auto-restart during development
- Frontend uses React's hot-reload feature
- MongoDB connection is configured in `backend/server.js`

## Notes

- Matches use best-of-5 sets format (first to 3 sets wins)
- Teams earn 2 points for a win
- Semi-finals are automatically generated based on team points
- Final match is generated after both semi-finals are completed

## Troubleshooting

1. **MongoDB connection error**: Make sure MongoDB is running
2. **Port already in use**: Change PORT in backend/.env or kill the process using the port
3. **CORS errors**: Backend CORS is configured to allow all origins (development only)

## License

ISC

