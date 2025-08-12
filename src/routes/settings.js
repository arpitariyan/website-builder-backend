// src/routes/settings.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

// Get user profile
router.get('/profile', authenticateToken, settingsController.getUserProfile);

// Update user profile
router.put('/profile', authenticateToken, settingsController.updateUserProfile);

// Get user statistics
router.get('/stats', authenticateToken, settingsController.getUserStats);

// Get learning data
router.get('/learning', authenticateToken, settingsController.getLearningData);

// Clear learning data
router.post('/learning/clear', authenticateToken, settingsController.clearLearningData);

// Export user data
router.get('/export', authenticateToken, settingsController.exportUserData);

// Delete account
router.delete('/account', authenticateToken, settingsController.deleteAccount);

module.exports = router;
