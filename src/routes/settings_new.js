// src/routes/settings.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, settingsController.getUserProfile);

// Update user profile
router.put('/profile', auth, settingsController.updateUserProfile);

// Get user statistics
router.get('/stats', auth, settingsController.getUserStats);

// Get learning data
router.get('/learning', auth, settingsController.getLearningData);

// Clear learning data
router.post('/learning/clear', auth, settingsController.clearLearningData);

// Export user data
router.get('/export', auth, settingsController.exportUserData);

// Delete account
router.delete('/account', auth, settingsController.deleteAccount);

module.exports = router;
