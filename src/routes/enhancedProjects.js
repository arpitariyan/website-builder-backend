// src/routes/enhancedProjects.js
const express = require('express');
const router = express.Router();
const { 
  uploadFiles, 
  createProject, 
  generateAIAnalysis, 
  generateCode, 
  getProjectDetails, 
  updateProjectDetails 
} = require('../controllers/enhancedProjectController');
const { authenticateToken } = require('../middleware/auth');

// Create new project with enhanced features
router.post('/create', authenticateToken, uploadFiles, createProject);

// Get project details with all metadata
router.get('/:projectId/details', authenticateToken, getProjectDetails);

// Update project details
router.put('/:projectId/details', authenticateToken, updateProjectDetails);

// Generate AI analysis and prompt
router.post('/:projectId/analyze', authenticateToken, generateAIAnalysis);

// Generate code from AI analysis
router.post('/:projectId/generate-code', authenticateToken, generateCode);

module.exports = router;
