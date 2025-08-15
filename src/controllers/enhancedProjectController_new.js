// src/controllers/enhancedProjectController.js
const Project = require('../models/Project');
const User = require('../models/User');
const enhancedAiService = require('../services/enhancedAiService');
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

// Enhanced save project content with optional file system persistence
const saveProjectContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;
    const { content, saveToFileSystem = false } = req.body;

    const project = await Project.findById(projectId);
    if (!project || project.userId !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update project content in database
    await Project.findByIdAndUpdate(projectId, {
      content: content,
      lastSaved: new Date()
    });

    // Optionally save to file system
    if (saveToFileSystem) {
      await saveContentToFileSystem(projectId, content);
    }

    res.json({ 
      success: true, 
      message: 'Project content saved successfully',
      savedToFileSystem: saveToFileSystem
    });
  } catch (error) {
    console.error('Error saving project content:', error);
    res.status(500).json({ 
      error: 'Failed to save project content',
      details: error.message 
    });
  }
};

// Save individual file content
const saveFileContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;
    const { fileName, content, saveToFileSystem = false } = req.body;

    const project = await Project.findById(projectId);
    if (!project || project.userId !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update specific file content in database
    const updatedContent = {
      ...project.content,
      [fileName]: content
    };

    await Project.findByIdAndUpdate(projectId, {
      content: updatedContent,
      lastSaved: new Date()
    });

    // Optionally save to file system
    if (saveToFileSystem) {
      await saveFileToFileSystem(projectId, fileName, content);
    }

    res.json({ 
      success: true, 
      message: 'File saved successfully',
      fileName,
      savedToFileSystem: saveToFileSystem
    });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ 
      error: 'Failed to save file',
      details: error.message 
    });
  }
};

// Helper function to save content to file system
const saveContentToFileSystem = async (projectId, content) => {
  const projectDir = path.join(__dirname, '../../storage/builds', projectId);
  await fs.mkdir(projectDir, { recursive: true });

  // Save each file to the file system
  for (const [fileName, fileContent] of Object.entries(content)) {
    const filePath = path.join(projectDir, fileName);
    const fileDir = path.dirname(filePath);
    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, fileContent, 'utf8');
  }
};

// Helper function to save individual file to file system
const saveFileToFileSystem = async (projectId, fileName, content) => {
  const projectDir = path.join(__dirname, '../../storage/builds', projectId);
  const filePath = path.join(projectDir, fileName);
  const fileDir = path.dirname(filePath);
  
  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
};

// Get preview URL for project
const getPreviewUrl = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    const project = await Project.findById(projectId);
    if (!project || project.userId !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project has been saved to file system
    const projectDir = path.join(__dirname, '../../storage/builds', projectId);
    const indexPath = path.join(projectDir, 'index.html');
    
    try {
      await fs.access(indexPath);
      const previewUrl = `${req.protocol}://${req.get('host')}/api/projects/${projectId}/preview`;
      const livePreviewUrl = `${req.protocol}://${req.get('host')}/api/projects/${projectId}/live-preview`;
      
      res.json({
        success: true,
        previewUrl,
        livePreviewUrl,
        hasFileSystem: true
      });
    } catch {
      res.json({
        success: true,
        previewUrl: null,
        livePreviewUrl: null,
        hasFileSystem: false,
        message: 'Project not saved to file system yet'
      });
    }
  } catch (error) {
    console.error('Error getting preview URL:', error);
    res.status(500).json({ 
      error: 'Failed to get preview URL',
      details: error.message 
    });
  }
};

// Serve static preview
const servePreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { '*': filePath = 'index.html' } = req.params;

    const projectDir = path.join(__dirname, '../../storage/builds', projectId);
    const requestedFile = path.join(projectDir, filePath);

    // Security check to prevent directory traversal
    if (!requestedFile.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const content = await fs.readFile(requestedFile, 'utf8');
      
      // Set appropriate content type
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      };
      
      res.set('Content-Type', contentTypes[ext] || 'text/plain');
      res.send(content);
    } catch (error) {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error serving preview:', error);
    res.status(500).json({ 
      error: 'Failed to serve preview',
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

module.exports = {
  uploadFiles,
  createProject,
  generateAIAnalysis,
  generateCode,
  getProjectDetails,
  updateProjectDetails,
  saveProjectContent,
  saveFileContent,
  getPreviewUrl,
  servePreview
};
