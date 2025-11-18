const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming'
  },
  description: {
    type: String,
    trim: true
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  semiFinalMatches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }],
  finalMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Tournament', tournamentSchema);

