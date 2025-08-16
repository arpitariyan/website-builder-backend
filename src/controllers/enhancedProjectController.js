// src/controllers/enhancedProjectController.js
const Project = require('../models/Project');
const User = require('../models/User');
const enhancedAiService = require('../services/enhancedAiService');
const aiOrchestrator = require('../services/aiOrchestrator');
const terminalService = require('../services/terminalService');
const figmaService = require('../services/figmaService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/project-files');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'), false);
    }
  }
});

// File upload middleware
const uploadFiles = upload.array('files', 3);

// Create project controller
const createProject = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      category, 
      isPublic, 
      figmaUrl,
      figmaFlows = [] 
    } = req.body;
    const userId = req.user.uid;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Project description is required' });
    }

    // Determine backend requirement based on category
    const backendRequiredCategories = ['e-commerce', 'business'];
    const backendRequired = backendRequiredCategories.includes(category);

    // Initialize project data
    const projectData = {
      name: name.trim(),
      description: description.trim(),
      category: category || 'other',
      backendRequired,
      userId,
      visibility: isPublic ? 'public' : 'private',
      status: 'draft'
    };

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      projectData.uploadedFiles = [];
      
      for (const file of req.files) {
        try {
          let parsedContent = '';
          
          // Parse file content based on type
          if (file.mimetype === 'application/pdf') {
            const pdfBuffer = await fs.readFile(file.path);
            const pdfData = await pdfParse(pdfBuffer);
            parsedContent = pdfData.text;
          } else if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/msword'
          ) {
            const result = await mammoth.extractRawText({ path: file.path });
            parsedContent = result.value;
          }

          projectData.uploadedFiles.push({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            parsedContent
          });
        } catch (parseError) {
          console.warn('Failed to parse file:', file.originalname, parseError.message);
          // Continue with file metadata even if parsing fails
          projectData.uploadedFiles.push({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            parsedContent: ''
          });
        }
      }
    }

    const project = new Project(projectData);
    await project.save();

    // Update user stats
    await User.findOneAndUpdate(
      { uid: userId },
      { $inc: { 'stats.projectsCreated': 1 } }
    );

    res.status(201).json({
      success: true,
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        category: project.category,
        backendRequired: project.backendRequired,
        status: project.status,
        visibility: project.visibility,
        uploadedFiles: project.uploadedFiles ? project.uploadedFiles.map(f => ({
          originalName: f.originalName,
          size: f.size,
          hasParsedContent: !!f.parsedContent
        })) : [],
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      error: 'Failed to create project',
      details: error.message 
    });
  }
};

const generateAIAnalysis = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { forceRegenerate = false } = req.body;
    const userId = req.user.uid;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if analysis already exists and not forcing regeneration
    if (project.aiAnalysis?.generatedPrompt && !forceRegenerate) {
      return res.json({
        success: true,
        analysis: project.aiAnalysis,
        cached: true
      });
    }

    // For now, create a simple analysis
    const analysisData = {
      name: project.name,
      description: project.description,
      category: project.category,
      backendRequired: project.backendRequired
    };

    const generatedPrompt = `Create a ${project.backendRequired ? 'full-stack' : 'frontend'} ${project.category} application called "${project.name}".

Requirements:
${project.description}

Technical Stack:
- Frontend: React with Tailwind CSS
${project.backendRequired ? '- Backend: Node.js with Express and MongoDB' : ''}
- Responsive design for all screen sizes
- Modern UI/UX principles

Please generate complete, production-ready code with proper file structure and comprehensive comments.`;

    // Update project with analysis
    project.aiAnalysis = {
      prompt: generatedPrompt,
      generatedPrompt: generatedPrompt,
      analysisData: {
        architecture: `${project.backendRequired ? 'Full-stack' : 'Frontend-only'} architecture`,
        features: 'Core features based on project description',
        techStack: `React, Tailwind CSS${project.backendRequired ? ', Node.js, Express, MongoDB' : ''}`,
        timeline: 'Estimated 2-4 weeks for development'
      },
      lastGenerated: new Date(),
      version: (project.aiAnalysis?.version || 0) + 1
    };

    project.status = 'ready';
    await project.save();

    res.json({
      success: true,
      analysis: project.aiAnalysis,
      cached: false
    });
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate analysis',
      details: error.message 
    });
  }
};

const generateCode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate basic code structure
    const generatedCode = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen">
        <header class="bg-blue-600 text-white p-6">
            <h1 class="text-3xl font-bold">${project.name}</h1>
            <p class="mt-2">${project.description}</p>
        </header>
        
        <main class="container mx-auto px-4 py-8">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-2xl font-semibold mb-4">Welcome to your ${project.category} project!</h2>
                <p class="text-gray-600">This is your generated ${project.name} application.</p>
            </div>
        </main>
    </div>
</body>
</html>`,
      css: `/* Custom styles for ${project.name} */
.hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card {
    transition: transform 0.2s;
}

.card:hover {
    transform: translateY(-2px);
}`,
      js: `// JavaScript for ${project.name}
document.addEventListener('DOMContentLoaded', function() {
    console.log('${project.name} loaded successfully');
    
    // Add your custom functionality here
});`
    };

    // Update project with generated code
    project.content = {
      html: generatedCode.html,
      css: generatedCode.css,
      js: generatedCode.js,
      components: [],
      pages: []
    };

    project.aiGeneration = {
      provider: 'internal',
      model: 'template-generator',
      prompt: project.aiAnalysis?.generatedPrompt || 'Basic template generation',
      generatedAt: new Date(),
      tokensUsed: 0,
      learningApplied: false
    };

    project.status = 'ready';
    project.lastSaved = new Date();
    await project.save();

    res.json({
      success: true,
      code: generatedCode,
      provider: 'internal',
      model: 'template-generator',
      tokensUsed: 0
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ 
      error: 'Failed to generate code',
      details: error.message 
    });
  }
};

const getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user can access this project
    if (project.userId !== userId && project.visibility !== 'public') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ 
      success: true,
      project: {
        ...project.toObject(),
        uploadedFiles: project.uploadedFiles?.map(f => ({
          originalName: f.originalName,
          size: f.size,
          uploadedAt: f.uploadedAt,
          hasParsedContent: !!f.parsedContent
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project details',
      details: error.message 
    });
  }
};

const updateProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project || project.userId !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'category', 'visibility'
    ];
    
    const updateData = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    updateData.lastSaved = new Date();

    await Project.findByIdAndUpdate(projectId, updateData);

    res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ 
      error: 'Failed to update project',
      details: error.message 
    });
  }
};

// AI-powered live code generation
const generateLiveCode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { component, description, type = 'full-project' } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Use AI Orchestrator for intelligent code generation
    const result = await aiOrchestrator.generateCode(userId, project, {
      type,
      component,
      description,
      stack: project.frontendTech || 'react',
      category: project.category
    });

    // Initialize workspace with generated files (DISABLED - no physical files)
    if (result.files) {
      // await terminalService.initializeWorkspace(projectId, result.files); // DISABLED
      
      // Update project with generated content
      project.content = result.files;
      project.status = 'ready';
      project.lastAiGeneration = {
        timestamp: new Date(),
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        source: result.source
      };
      await project.save();
    }

    res.json({
      success: true,
      files: result.files,
      metadata: {
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        source: result.source,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error generating live code:', error);
    res.status(500).json({ 
      error: 'Failed to generate code',
      details: error.message 
    });
  }
};

// Terminal management endpoints
const createTerminal = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { initialPath } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const terminal = terminalService.createTerminal(projectId, userId, initialPath);
    
    res.json({
      success: true,
      terminal
    });
  } catch (error) {
    console.error('Error creating terminal:', error);
    res.status(500).json({ 
      error: 'Failed to create terminal',
      details: error.message 
    });
  }
};

const executeTerminalCommand = async (req, res) => {
  try {
    const { terminalId } = req.params;
    const { command } = req.body;
    
    terminalService.executeCommand(terminalId, command);
    
    res.json({
      success: true,
      message: 'Command executed'
    });
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ 
      error: 'Failed to execute command',
      details: error.message 
    });
  }
};

const getTerminalOutput = async (req, res) => {
  try {
    const { terminalId } = req.params;
    const { lines = 100 } = req.query;
    
    const output = terminalService.getTerminalOutput(terminalId, parseInt(lines));
    
    res.json({
      success: true,
      output
    });
  } catch (error) {
    console.error('Error getting terminal output:', error);
    res.status(500).json({ 
      error: 'Failed to get terminal output',
      details: error.message 
    });
  }
};

// File system management
const getWorkspaceTree = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tree = await terminalService.getWorkspaceTree(projectId);
    
    res.json({
      success: true,
      tree
    });
  } catch (error) {
    console.error('Error getting workspace tree:', error);
    res.status(500).json({ 
      error: 'Failed to get workspace tree',
      details: error.message 
    });
  }
};

const readWorkspaceFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { filePath } = req.query;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const file = await terminalService.readWorkspaceFile(projectId, filePath);
    
    res.json({
      success: true,
      file
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ 
      error: 'Failed to read file',
      details: error.message 
    });
  }
};

const writeWorkspaceFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { filePath, content } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await terminalService.writeWorkspaceFile(projectId, filePath, content);
    
    // Update project content in database
    if (!project.content) project.content = {};
    project.content[filePath] = { content, language: 'javascript' };
    await project.save();
    
    res.json({
      success: true,
      message: 'File saved successfully'
    });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ 
      error: 'Failed to write file',
      details: error.message 
    });
  }
};

const deleteWorkspaceFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { filePath } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await terminalService.deleteWorkspaceFile(projectId, filePath);
    
    // Remove from project content
    if (project.content && project.content[filePath]) {
      delete project.content[filePath];
      await project.save();
    }
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message 
    });
  }
};

const createWorkspaceDirectory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { dirPath } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await terminalService.createWorkspaceDirectory(projectId, dirPath);
    
    res.json({
      success: true,
      message: 'Directory created successfully'
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ 
      error: 'Failed to create directory',
      details: error.message 
    });
  }
};

// Package management
const installPackages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { packages, isDevDependency = false } = req.body;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await terminalService.installPackages(projectId, packages, isDevDependency);
    
    res.json({
      success: true,
      terminalId: result.terminalId,
      command: result.command
    });
  } catch (error) {
    console.error('Error installing packages:', error);
    res.status(500).json({ 
      error: 'Failed to install packages',
      details: error.message 
    });
  }
};

// Build and deployment
const runBuild = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await terminalService.runBuild(projectId);
    
    res.json({
      success: true,
      terminalId: result.terminalId
    });
  } catch (error) {
    console.error('Error running build:', error);
    res.status(500).json({ 
      error: 'Failed to run build',
      details: error.message 
    });
  }
};

const runDevServer = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await terminalService.runDevServer(projectId);
    
    res.json({
      success: true,
      terminalId: result.terminalId
    });
  } catch (error) {
    console.error('Error running dev server:', error);
    res.status(500).json({ 
      error: 'Failed to run dev server',
      details: error.message 
    });
  }
};

// AI Knowledge Base endpoints
const getKnowledgeStats = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const stats = await aiOrchestrator.getKnowledgeStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting knowledge stats:', error);
    res.status(500).json({ 
      error: 'Failed to get knowledge stats',
      details: error.message 
    });
  }
};

module.exports = {
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
  getKnowledgeStats
};
