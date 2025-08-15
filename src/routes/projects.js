// src/routes/projects.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../storage/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt|doc|docx|zip|rar|md/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all projects for authenticated user
router.get('/', authenticateToken, projectController.getProjects);

// Get public projects (no auth required)
router.get('/public', projectController.getPublicProjects);

// Get specific project
router.get('/:projectId', authenticateToken, projectController.getProject);

// Create new project
router.post('/', authenticateToken, projectController.createProject);

// Create enhanced project with file uploads
router.post('/enhanced/create', authenticateToken, upload.fields([
  { name: 'documentation', maxCount: 5 },
  { name: 'designFiles', maxCount: 5 }
]), projectController.createEnhancedProject);

// Update project
router.put('/:projectId', authenticateToken, projectController.updateProject);

// Delete project
router.delete('/:projectId', authenticateToken, projectController.deleteProject);

// Generate code for project
router.post('/:projectId/generate', authenticateToken, projectController.generateCode);

// Generate enhanced code with database-first approach
router.post('/:projectId/generate/enhanced', authenticateToken, projectController.generateEnhancedCode);

// Generate code from Figma
router.post('/:projectId/figma', authenticateToken, projectController.generateFromFigma);

module.exports = router;
