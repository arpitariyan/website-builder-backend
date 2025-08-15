// src/routes/enhancedProjects.js
const express = require('express');
const router = express.Router();
const { 
  uploadFiles, 
  createProject, 
  generateAIAnalysis, 
  generateCode, 
  getProjectDetails, 
  updateProjectDetails,
  // New AI Core methods
  generateLiveCode,
  // Terminal methods
  createTerminal,
  executeTerminalCommand,
  getTerminalOutput,
  // File system methods
  getWorkspaceTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  deleteWorkspaceFile,
  createWorkspaceDirectory,
  // Package management
  installPackages,
  // Build and deployment
  runBuild,
  runDevServer,
  // AI Knowledge Base
  getKnowledgeStats,
  // Enhanced save and preview
  saveProjectContent,
  saveFileContent,
  getPreviewUrl,
  servePreview
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

// AI-powered live code generation
router.post('/:projectId/generate-live-code', authenticateToken, generateLiveCode);

// Terminal management
router.post('/:projectId/terminal/create', authenticateToken, createTerminal);
router.post('/terminal/:terminalId/execute', authenticateToken, executeTerminalCommand);
router.get('/terminal/:terminalId/output', authenticateToken, getTerminalOutput);

// File system management
router.get('/:projectId/workspace/tree', authenticateToken, getWorkspaceTree);
router.get('/:projectId/workspace/file', authenticateToken, readWorkspaceFile);
router.post('/:projectId/workspace/file', authenticateToken, writeWorkspaceFile);
router.delete('/:projectId/workspace/file', authenticateToken, deleteWorkspaceFile);
router.post('/:projectId/workspace/directory', authenticateToken, createWorkspaceDirectory);

// Package management
router.post('/:projectId/packages/install', authenticateToken, installPackages);

// Build and deployment
router.post('/:projectId/build', authenticateToken, runBuild);
router.post('/:projectId/dev', authenticateToken, runDevServer);

// AI Knowledge Base
router.get('/knowledge/stats', authenticateToken, getKnowledgeStats);

// Enhanced save functionality
router.post('/:projectId/save-content', authenticateToken, saveProjectContent);
router.post('/:projectId/save-file', authenticateToken, saveFileContent);

// Preview functionality
router.get('/:projectId/preview-url', authenticateToken, getPreviewUrl);
router.get('/:projectId/preview/*', servePreview);
router.get('/:projectId/preview', servePreview);

module.exports = router;
