// src/routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const auth = require('../middleware/auth');

// Get all projects for authenticated user
router.get('/', auth, projectController.getProjects);

// Get public projects (no auth required)
router.get('/public', projectController.getPublicProjects);

// Get specific project
router.get('/:projectId', auth, projectController.getProject);

// Create new project
router.post('/', auth, projectController.createProject);

// Update project
router.put('/:projectId', auth, projectController.updateProject);

// Delete project
router.delete('/:projectId', auth, projectController.deleteProject);

// Generate code for project
router.post('/:projectId/generate', auth, projectController.generateCode);

// Generate code from Figma
router.post('/:projectId/figma', auth, projectController.generateFromFigma);

module.exports = router;
