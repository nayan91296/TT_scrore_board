const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  team1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  team2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: false  // Can be null initially for Semi-final 2
  },
  matchType: {
    type: String,
    enum: ['group', 'quarterfinal', 'semifinal', 'final'],
    default: 'group'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed'],
    default: 'scheduled'
  },
  scores: [{
    setNumber: {
      type: Number,
      required: true
    },
    team1Score: {
      type: Number,
      default: 0
    },
    team2Score: {
      type: Number,
      default: 0
    }
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  matchDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);

