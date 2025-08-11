// src/routes/templates.js
const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const { optionalAuth } = require('../middleware/auth');

// Get all templates
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    
    let query = { isActive: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const templates = await Template.find(query)
      .select('name description category thumbnail previewUrl isPremium tags rating usageCount')
      .sort({ usageCount: -1, rating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Template.countDocuments(query);

    res.json({
      success: true,
      templates,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: skip + templates.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
});

// Get template categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Template.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      categories: [
        { name: 'all', count: await Template.countDocuments({ isActive: true }) },
        ...categories.map(cat => ({ name: cat._id, count: cat.count }))
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get specific template
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: error.message
    });
  }
});

// Get featured templates
router.get('/featured/list', async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true })
      .select('name description category thumbnail previewUrl isPremium tags rating usageCount')
      .sort({ rating: -1, usageCount: -1 })
      .limit(6);

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured templates',
      error: error.message
    });
  }
});

module.exports = router;
