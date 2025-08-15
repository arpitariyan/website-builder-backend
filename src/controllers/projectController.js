// src/controllers/projectController.js
const Project = require('../models/Project');
const User = require('../models/User');
const enhancedAiService = require('../services/enhancedAiService');
const figmaService = require('../services/figmaService');
const { v4: uuidv4 } = require('uuid');

class ProjectController {
  async createProject(req, res) {
    try {
      const { name, description, category, isPublic, figmaUrl } = req.body;
      const userId = req.user.uid;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      // Initialize project data
      const projectData = {
        name: name.trim(),
        description: description || '',
        userId,
        visibility: isPublic ? 'public' : 'private',
        status: 'draft'
      };

      // Handle Figma integration
      if (figmaUrl) {
        try {
          const figmaData = await figmaService.getFileData(userId, figmaUrl);
          projectData.figmaData = {
            figmaUrl,
            fileKey: figmaData.fileKey,
            nodeId: figmaData.nodeId,
            designData: figmaData,
            lastSync: new Date()
          };
        } catch (figmaError) {
          console.warn('Figma integration failed:', figmaError.message);
          // Continue without Figma data
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
          status: project.status,
          visibility: project.visibility,
          figmaData: project.figmaData ? {
            figmaUrl: project.figmaData.figmaUrl,
            hasDesignData: !!project.figmaData.designData
          } : null,
          createdAt: project.createdAt
        }
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  async createEnhancedProject(req, res) {
    try {
      const { 
        name, 
        description, 
        category, 
        projectType,
        techStack,
        features,
        isPublic,
        figmaUrl,
        requirements 
      } = req.body;
      const userId = req.user.uid;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      // Parse arrays from FormData if they're strings
      const parsedTechStack = typeof techStack === 'string' ? JSON.parse(techStack) : techStack;
      const parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;

      // Initialize enhanced project data
      const projectData = {
        name: name.trim(),
        description: description || '',
        userId,
        category: category || 'web',
        projectType: projectType || 'website',
        techStack: parsedTechStack || [],
        features: parsedFeatures || [],
        requirements: requirements || '',
        visibility: isPublic === 'true' || isPublic === true ? 'public' : 'private',
        status: 'planning',
        enhanced: true
      };

      // Handle file uploads
      if (req.files) {
        projectData.attachments = {};
        
        if (req.files.documentation) {
          projectData.attachments.documentation = req.files.documentation.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            uploadedAt: new Date()
          }));
        }
        
        if (req.files.designFiles) {
          projectData.attachments.designFiles = req.files.designFiles.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            uploadedAt: new Date()
          }));
        }
      }

      // Handle Figma integration
      if (figmaUrl) {
        try {
          const figmaData = await figmaService.getFileData(userId, figmaUrl);
          projectData.figmaData = {
            figmaUrl,
            fileKey: figmaData.fileKey,
            nodeId: figmaData.nodeId,
            designData: figmaData,
            lastSync: new Date()
          };
        } catch (figmaError) {
          console.warn('Figma integration failed:', figmaError.message);
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
        message: 'Enhanced project created successfully',
        project: {
          _id: project._id,
          name: project.name,
          description: project.description,
          category: project.category,
          projectType: project.projectType,
          techStack: project.techStack,
          features: project.features,
          status: project.status,
          enhanced: project.enhanced,
          createdAt: project.createdAt
        }
      });
    } catch (error) {
      console.error('Error creating enhanced project:', error);
      res.status(500).json({ error: 'Failed to create enhanced project' });
    }
  }

  async generateCode(req, res) {
    try {
      const { projectId } = req.params;
      const { prompt, component, provider, options = {} } = req.body;
      const userId = req.user.uid;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Update project status
      project.status = 'generating';
      await project.save();

      try {
        // Generate code using enhanced AI service
        const result = await enhancedAiService.generateCode(userId, prompt, {
          ...options,
          provider,
          component,
          type: options.type || 'component'
        });

        // Update project with generated code
        if (component) {
          // Add or update specific component
          const componentIndex = project.content.components.findIndex(c => c.id === component);
          if (componentIndex >= 0) {
            project.content.components[componentIndex].code = result.code;
          } else {
            project.content.components.push({
              id: uuidv4(),
              name: component,
              type: options.type || 'component',
              code: result.code
            });
          }
        } else {
          // Update main content
          if (options.type === 'html') {
            project.content.html = result.code;
          } else if (options.type === 'css') {
            project.content.css = result.code;
          } else {
            project.content.js = result.code;
          }
        }

        // Store AI generation info
        project.aiGeneration = {
          provider: result.provider,
          model: result.model,
          prompt,
          generatedAt: new Date(),
          tokensUsed: result.tokensUsed,
          learningApplied: result.provider === 'learning'
        };

        project.status = 'draft';
        project.lastSaved = new Date();
        await project.save();

        // Update user stats
        await User.findOneAndUpdate(
          { uid: userId },
          { 
            $inc: { 
              'stats.totalBuilds': 1,
              'stats.successfulBuilds': 1
            },
            $set: { 'stats.lastActive': new Date() }
          }
        );

        res.json({
          success: true,
          code: result.code,
          provider: result.provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          component
        });

      } catch (aiError) {
        console.error('AI generation failed:', aiError);
        
        // Try to debug and fix the error
        project.addError(aiError);
        project.status = 'error';
        await project.save();

        res.status(500).json({ 
          error: 'Code generation failed',
          details: aiError.message 
        });
      }

    } catch (error) {
      console.error('Error in generateCode:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async generateEnhancedCode(req, res) {
    try {
      const { projectId } = req.params;
      const { 
        prompt, 
        fileType, 
        fileName, 
        targetComponent,
        includeDatabase = false,
        provider,
        options = {} 
      } = req.body;
      const userId = req.user.uid;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      project.status = 'generating';
      await project.save();

      try {
        // Build enhanced context with project data and attachments
        const enhancedContext = await this.buildEnhancedContext(project, {
          includeDatabase,
          fileType,
          targetComponent
        });

        // Generate code with enhanced AI service
        const result = await enhancedAiService.generateCode(userId, prompt, {
          ...options,
          context: enhancedContext,
          projectType: project.projectType,
          techStack: project.techStack,
          features: project.features,
          fileType,
          fileName,
          provider: provider || 'openai'
        });

        // Save generated code to project
        const codeUpdate = {
          [`generatedFiles.${fileName || 'index'}`]: {
            content: result.content,
            type: fileType || 'javascript',
            generatedAt: new Date(),
            prompt: prompt,
            provider: result.provider,
            tokensUsed: result.tokensUsed
          }
        };

        await Project.findByIdAndUpdate(projectId, {
          ...codeUpdate,
          status: 'ready',
          'aiGeneration.lastGenerated': new Date(),
          'aiGeneration.provider': result.provider,
          'aiGeneration.tokensUsed': result.tokensUsed
        });

        res.json({
          success: true,
          message: 'Enhanced code generated successfully',
          result: {
            content: result.content,
            fileName: fileName || 'index',
            fileType: fileType || 'javascript',
            provider: result.provider,
            tokensUsed: result.tokensUsed,
            suggestions: result.suggestions || []
          }
        });

      } catch (aiError) {
        console.error('Enhanced AI generation failed:', aiError);
        
        project.addError(aiError);
        project.status = 'error';
        await project.save();

        res.status(500).json({ 
          error: 'Enhanced code generation failed',
          details: aiError.message 
        });
      }

    } catch (error) {
      console.error('Error in generateEnhancedCode:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async buildEnhancedContext(project, options = {}) {
    const context = {
      projectInfo: {
        name: project.name,
        description: project.description,
        type: project.projectType,
        category: project.category,
        techStack: project.techStack,
        features: project.features,
        requirements: project.requirements
      }
    };

    // Include existing code if available
    if (project.content) {
      context.existingCode = {
        html: project.content.html,
        css: project.content.css,
        js: project.content.js,
        components: project.content.components
      };
    }

    // Include generated files
    if (project.generatedFiles) {
      context.generatedFiles = project.generatedFiles;
    }

    // Include Figma data if available
    if (project.figmaData && project.figmaData.designData) {
      context.designData = {
        figmaUrl: project.figmaData.figmaUrl,
        screens: project.figmaData.designData.screens || [],
        components: project.figmaData.designData.components || []
      };
    }

    // Include uploaded documentation
    if (project.attachments && project.attachments.documentation) {
      // In a real implementation, you'd read and parse the uploaded files
      context.documentation = project.attachments.documentation.map(doc => ({
        name: doc.originalName,
        path: doc.path,
        uploadedAt: doc.uploadedAt
      }));
    }

    // Include database schema if requested
    if (options.includeDatabase && project.techStack.includes('database')) {
      // In a real implementation, you'd include database schema information
      context.database = {
        type: 'mongodb', // or detect from tech stack
        schema: 'will be generated based on requirements'
      };
    }

    return context;
  }

  async generateFromFigma(req, res) {
    try {
      const { projectId } = req.params;
      const { figmaUrl } = req.body;
      const userId = req.user.uid;

      if (!figmaUrl) {
        return res.status(400).json({ error: 'Figma URL is required' });
      }

      const project = await Project.findById(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get Figma design data and generate code
      const figmaResult = await figmaService.generateCodeFromDesign(userId, figmaUrl);
      
      // Generate code based on Figma analysis
      const prompt = this.buildPromptFromFigmaAnalysis(figmaResult.analysis);
      const codeResult = await enhancedAiService.generateCode(userId, prompt, {
        type: 'page',
        figmaData: figmaResult
      });

      // Update project with Figma data and generated code
      project.figmaData = {
        figmaUrl,
        designData: figmaResult.designData,
        lastSync: new Date()
      };
      project.content.html = codeResult.code;
      project.aiGeneration = {
        provider: codeResult.provider,
        model: codeResult.model,
        prompt,
        generatedAt: new Date(),
        tokensUsed: codeResult.tokensUsed,
        learningApplied: false
      };

      await project.save();

      res.json({
        success: true,
        code: codeResult.code,
        figmaAnalysis: figmaResult.analysis,
        recommendations: figmaResult.recommendations
      });

    } catch (error) {
      console.error('Error generating from Figma:', error);
      res.status(500).json({ error: error.message });
    }
  }

  buildPromptFromFigmaAnalysis(analysis) {
    let prompt = 'Create a React component based on this design analysis:\n\n';
    
    if (analysis.components.length > 0) {
      prompt += 'Components:\n';
      analysis.components.forEach(comp => {
        prompt += `- ${comp.name} (${comp.type})\n`;
      });
      prompt += '\n';
    }

    if (analysis.colors.length > 0) {
      prompt += `Colors: ${analysis.colors.join(', ')}\n`;
    }

    if (analysis.fonts.length > 0) {
      prompt += `Fonts: ${analysis.fonts.join(', ')}\n`;
    }

    if (analysis.dimensions.width && analysis.dimensions.height) {
      prompt += `Dimensions: ${analysis.dimensions.width}x${analysis.dimensions.height}\n`;
    }

    prompt += '\nGenerate a modern, responsive React component using Tailwind CSS that matches this design.';
    
    return prompt;
  }

  async getProjects(req, res) {
    try {
      const userId = req.user.uid;
      const { visibility, status, page = 1, limit = 10 } = req.query;
      
      const query = { userId };
      if (visibility) query.visibility = visibility;
      if (status) query.status = status;

      const projects = await Project.find(query)
        .select('-content.html -content.css -content.js') // Exclude large content fields
        .sort({ updatedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Project.countDocuments(query);

      res.json({
        projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }

  async getProject(req, res) {
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

      // Increment view count for public projects
      if (project.visibility === 'public' && project.userId !== userId) {
        project.analytics.views++;
        project.analytics.lastViewed = new Date();
        await project.save();
      }

      res.json({ project });
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  async updateProject(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.user.uid;
      const updates = req.body;

      const project = await Project.findById(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update allowed fields
      const allowedUpdates = ['name', 'description', 'visibility', 'content', 'settings'];
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
      res.status(500).json({ error: 'Failed to update project' });
    }
  }

  async deleteProject(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.user.uid;

      const project = await Project.findById(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await Project.findByIdAndDelete(projectId);

      res.json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  async getPublicProjects(req, res) {
    try {
      const { page = 1, limit = 12, category } = req.query;
      
      const query = { visibility: 'public', status: 'published' };
      if (category) query.category = category;

      const projects = await Project.find(query)
        .select('name description thumbnail analytics createdAt userId')
        .populate('userId', 'displayName photoURL')
        .sort({ 'analytics.views': -1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Project.countDocuments(query);

      res.json({
        projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching public projects:', error);
      res.status(500).json({ error: 'Failed to fetch public projects' });
    }
  }
}

module.exports = new ProjectController();
