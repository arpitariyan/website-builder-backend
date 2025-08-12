// src/routes/settings.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getUserSettings,
  updateUserProfile,
  updatePassword,
  saveAPIKey,
  updateCodeGenPreferences,
  updateFigmaSettings,
  testAPIKey,
  getUsageStats
} = require('../controllers/settingsController');

// Get user settings
router.get('/user', authenticateToken, getUserSettings);

// Update user profile
router.put('/profile', authenticateToken, updateUserProfile);

// Update password
router.put('/password', authenticateToken, updatePassword);

// API Keys management
router.post('/api-keys', authenticateToken, saveAPIKey);
router.post('/api-keys/test', authenticateToken, testAPIKey);

// Code generation preferences
router.put('/code-generation', authenticateToken, updateCodeGenPreferences);

// Figma integration settings
router.put('/figma', authenticateToken, updateFigmaSettings);

// Usage statistics
router.get('/usage', authenticateToken, getUsageStats);

module.exports = router;
