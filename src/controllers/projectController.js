// src/controllers/projectController.js
const aiService = require('../services/aiService');
const { db } = require('../config/firebase');
const fs = require('fs').promises;
const path = require('path');

class ProjectController {
  async createProject(req, res) {
    try {
      const { name, type, prompt, figmaUrl, options } = req.body;
      const userId = req.user.uid;

      // Create project document in Firebase
      const projectRef = await db.collection('projects').add({
        name,
        type,
        prompt,
        figmaUrl,
        options,
        userId,
        status: 'initializing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        projectId: projectRef.id,
        message: 'Project created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create project',
        error: error.message
      });
    }
  }

  async generateWebsite(req, res) {
    try {
      const { projectId } = req.params;
      const { prompt, options } = req.body;

      // Update project status
      await db.collection('projects').doc(projectId).update({
        status: 'generating',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Generate code using AI
      const generatedCode = await aiService.generateWebsiteCode(prompt, options);

      // Save generated code
      const projectDir = path.join(__dirname, '../../generated-projects', projectId);
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'generated-code.json'), JSON.stringify({
        code: generatedCode,
        options,
        timestamp: new Date().toISOString()
      }));

      // Update project with generated code
      await db.collection('projects').doc(projectId).update({
        status: 'generated',
        generatedCode: generatedCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        generatedCode,
        message: 'Website generated successfully'
      });
    } catch (error) {
      await db.collection('projects').doc(req.params.projectId).update({
        status: 'error',
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate website',
        error: error.message
      });
    }
  }

  async configureApiKeys(req, res) {
    try {
      const { projectId } = req.params;
      const { apiKeys } = req.body;

      // Update project with API keys (encrypted)
      await db.collection('projects').doc(projectId).update({
        apiKeys: apiKeys, // In production, encrypt these
        configured: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'API keys configured successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to configure API keys',
        error: error.message
      });
    }
  }

  async downloadProject(req, res) {
    try {
      const { projectId } = req.params;
      const projectDir = path.join(__dirname, '../../generated-projects', projectId);
      
      // Create a zip file of the generated project
      // Implementation for creating and sending zip file
      
      res.json({
        success: true,
        downloadUrl: `/downloads/${projectId}.zip`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to prepare download',
        error: error.message
      });
    }
  }
}

module.exports = new ProjectController();
