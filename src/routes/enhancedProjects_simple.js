// src/routes/enhancedProjects.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Test endpoint
router.get('/test', authenticateToken, (req, res) => {
  res.json({ message: 'Enhanced routes working' });
});

module.exports = router;
