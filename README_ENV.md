# Environment Variables Setup

This project uses separate environment variable files for frontend and backend.

## Backend Environment Variables

Location: `backend/.env`

1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env` with your actual values:
   ```env
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/tt-tournament
   ```

### Available Backend Variables:
- `PORT` - Server port (default: 5001)
- `MONGODB_URI` - MongoDB connection string
- `CORS_ORIGIN` - CORS allowed origins (optional, comma-separated)

## Frontend Environment Variables

Location: `frontend/.env`

1. Copy the example file:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Update `frontend/.env` with your actual values:
   ```env
   REACT_APP_API_URL=http://localhost:5001/api
   ```

### Available Frontend Variables:
- `REACT_APP_API_URL` - Backend API URL (must be prefixed with `REACT_APP_`)

**Important:** 
- All React environment variables must be prefixed with `REACT_APP_`
- After changing `.env` files, restart the development server
- `.env` files are git-ignored, so they won't be committed to the repository

## Quick Start

1. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your values
   npm install
   npm start
   ```

2. **Frontend:**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your values
   npm install
   npm start
   ```

## Notes

- For local development, the default values should work out of the box
- For production, update the API URL to point to your production backend
- For MongoDB Atlas, update `MONGODB_URI` with your Atlas connection string

