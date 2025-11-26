const express = require('express');
const router = express.Router();
const requirePin = require('../middleware/requirePin');

// Simple endpoint to let frontend verify PIN via backend
router.post('/verify-pin', requirePin, (req, res) => {
  return res.json({ valid: true });
});

module.exports = router;


