// src/routes/ai.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// All AI routes require authentication
router.use(authenticateToken);

// Enhanced code generation with database-first approach
router.post('/generate', aiController.generateCode);

// Rate a code template
router.post('/rate', aiController.rateTemplate);

// Get user's code generation history
router.get('/history', aiController.getCodeHistory);

// Search database templates
router.get('/search', aiController.searchTemplates);

module.exports = router;
