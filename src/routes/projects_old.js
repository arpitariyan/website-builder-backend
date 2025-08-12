// src/routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Template = require('../models/Template');
const { authenticateToken } = require('../middleware/auth');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

// Get all projects for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.uid })
      .select('name description status thumbnail createdAt updatedAt lastSaved')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

// Get specific project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project',
      error: error.message
    });
  }
});

// Create new project
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, description, templateId } = req.body;

    let projectData = {
      name,
      description,
      userId: req.user.uid,
      templateId,
      content: {
        html: '',
        css: '',
        js: '',
        components: [],
        pages: [{
          id: 'page-1',
          name: 'Home',
          path: '/',
          components: []
        }]
      },
      settings: {
        responsive: {
          desktop: { width: 1200 },
          tablet: { width: 768 },
          mobile: { width: 375 }
        },
        seo: {
          title: name,
          description: description || '',
          keywords: []
        },
        theme: {
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px'
        }
      }
    };

    // If template is provided, copy template content
    if (templateId) {
      const template = await Template.findById(templateId);
      if (template) {
        projectData.content = { ...template.content };
        projectData.settings = { ...template.settings };
        projectData.thumbnail = template.thumbnail;
        
        // Increment template usage count
        await Template.findByIdAndUpdate(templateId, {
          $inc: { usageCount: 1 }
        });
      }
    }

    const project = new Project(projectData);
    await project.save();

    res.status(201).json({
      success: true,
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt
      },
      message: 'Project created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: error.message
    });
  }
});

// Update project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { 
        ...req.body,
        lastSaved: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      project,
      message: 'Project updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  }
});

// Auto-save project content
router.patch('/:id/autosave', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { 
        content,
        lastSaved: new Date()
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      lastSaved: project.lastSaved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to auto-save project',
      error: error.message
    });
  }
});

// Duplicate project
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const originalProject = await Project.findOne({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (!originalProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const duplicatedProject = new Project({
      ...originalProject.toObject(),
      _id: undefined,
      name: `${originalProject.name} (Copy)`,
      subdomain: null,
      publishedUrl: null,
      status: 'draft',
      createdAt: undefined,
      updatedAt: undefined
    });

    await duplicatedProject.save();

    res.status(201).json({
      success: true,
      project: duplicatedProject,
      message: 'Project duplicated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate project',
      error: error.message
    });
  }
});

// Publish project
router.post('/:id/publish', authenticateToken, async (req, res) => {
  try {
    const { subdomain } = req.body;
    
    // Check if subdomain is available
    if (subdomain) {
      const existingProject = await Project.findOne({ subdomain });
      if (existingProject && existingProject._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          message: 'Subdomain already taken'
        });
      }
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      {
        status: 'published',
        subdomain: subdomain || `project-${req.params.id}`,
        publishedUrl: `https://${subdomain || `project-${req.params.id}`}.yourapp.com`
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      project,
      publishedUrl: project.publishedUrl,
      message: 'Project published successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to publish project',
      error: error.message
    });
  }
});

// Download project code
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Create temporary directory for project files
    const tempDir = path.join(__dirname, '../../temp', project._id.toString());
    await fs.mkdir(tempDir, { recursive: true });

    // Write project files
    await fs.writeFile(
      path.join(tempDir, 'index.html'),
      project.content.html || '<!DOCTYPE html><html><head><title>Website</title></head><body></body></html>'
    );
    
    await fs.writeFile(
      path.join(tempDir, 'styles.css'),
      project.content.css || ''
    );
    
    await fs.writeFile(
      path.join(tempDir, 'script.js'),
      project.content.js || ''
    );

    // Create package.json
    const packageJson = {
      name: project.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: project.description,
      main: 'index.html',
      scripts: {
        start: 'http-server -p 3000'
      }
    };
    
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create zip file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(tempDir, false);
    await archive.finalize();

    // Clean up temp directory
    setTimeout(async () => {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        console.error('Failed to clean up temp directory:', error);
      }
    }, 5000);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download project',
      error: error.message
    });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
});

module.exports = router;
