// src/controllers/aiController.js
const enhancedAiService = require('../services/enhancedAiService');

// Generate code with intelligent database-first approach
const generateCode = async (req, res) => {
  try {
    const { prompt, type = 'component', framework = 'react', style = 'modern' } = req.body;
    const userId = req.user.uid;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    const result = await enhancedAiService.generateCode(prompt, userId, {
      type,
      framework,
      style
    });

    if (result.success) {
      res.json({
        success: true,
        code: result.code,
        source: result.source,
        templateId: result.templateId,
        confidence: result.confidence,
        model: result.model
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Code generation failed'
      });
    }
  } catch (error) {
    console.error('Generate code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Rate a code template
const rateTemplate = async (req, res) => {
  try {
    const { templateId, rating } = req.body;
    const userId = req.user.uid;

    if (!templateId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid template ID and rating (1-5) are required'
      });
    }

    const result = await enhancedAiService.rateTemplate(templateId, rating, userId);

    if (result.success) {
      res.json({
        success: true,
        averageRating: result.averageRating,
        message: 'Template rated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to rate template'
      });
    }
  } catch (error) {
    console.error('Rate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's code generation history
const getCodeHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit) || 20;

    const result = await enhancedAiService.getUserCodeHistory(userId, limit);

    if (result.success) {
      res.json({
        success: true,
        templates: result.templates
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch history'
      });
    }
  } catch (error) {
    console.error('Get code history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Search database templates
const searchTemplates = async (req, res) => {
  try {
    const { query, type = 'component', framework = 'react', limit = 10 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const result = await enhancedAiService.searchDatabaseTemplates(query, {
      type,
      framework
    });

    res.json({
      success: true,
      found: result.found,
      template: result.found ? {
        code: result.code,
        templateId: result.templateId,
        confidence: result.confidence
      } : null
    });
  } catch (error) {
    console.error('Search templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  generateCode,
  rateTemplate,
  getCodeHistory,
  searchTemplates
};
