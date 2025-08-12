// src/routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');

// Get all projects for authenticated user
router.get('/', authenticateToken, projectController.getProjects);

// Get public projects (no auth required)
router.get('/public', projectController.getPublicProjects);

// Get specific project
router.get('/:projectId', authenticateToken, projectController.getProject);

// Create new project
router.post('/', authenticateToken, projectController.createProject);

// Update project
router.put('/:projectId', authenticateToken, projectController.updateProject);

// Delete project
router.delete('/:projectId', authenticateToken, projectController.deleteProject);

// Generate code for project
router.post('/:projectId/generate', authenticateToken, projectController.generateCode);

// Generate code from Figma
router.post('/:projectId/figma', authenticateToken, projectController.generateFromFigma);

module.exports = router;
