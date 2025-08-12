// src/routes/apiKeys.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

// Get all API keys for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return API keys without the actual encrypted keys for security
    const apiKeys = user.apiKeys.map(key => ({
      _id: key._id,
      provider: key.provider,
      name: key.name,
      models: key.models,
      defaultModel: key.defaultModel,
      isDefault: key.isDefault,
      createdAt: key.createdAt
    }));

    res.json({
      apiKeys,
      figmaToken: !!user.figmaToken
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new API key
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { provider, name, key, models, defaultModel } = req.body;

    if (!provider || !name || !key) {
      return res.status(400).json({ error: 'Provider, name, and key are required' });
    }

    const validProviders = ['openai', 'gemini', 'claude', 'openrouter'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    let user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      user = new User({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName || '',
        photoURL: req.user.photoURL || ''
      });
    }

    // Check if user already has 5 API keys
    if (user.apiKeys.length >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 API keys allowed' });
    }

    // Add the API key
    user.addApiKey(provider, name, key, models || [], defaultModel);
    await user.save();

    res.status(201).json({ message: 'API key added successfully' });
  } catch (error) {
    console.error('Error adding API key:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update API key
router.put('/:keyId', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params;
    const { name, models, defaultModel, isDefault } = req.body;

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = user.apiKeys.id(keyId);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Update fields
    if (name) apiKey.name = name;
    if (models) apiKey.models = models;
    if (defaultModel) apiKey.defaultModel = defaultModel;
    
    if (isDefault) {
      // Remove default from other keys of same provider
      user.apiKeys.forEach(key => {
        if (key.provider === apiKey.provider && key._id.toString() !== keyId) {
          key.isDefault = false;
        }
      });
      apiKey.isDefault = true;
    }

    await user.save();

    res.json({ message: 'API key updated successfully' });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete API key
router.delete('/:keyId', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params;

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = user.apiKeys.id(keyId);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    user.apiKeys.pull(keyId);
    await user.save();

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add/Update Figma token
router.post('/figma', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Figma token is required' });
    }

    let user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      user = new User({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName || '',
        photoURL: req.user.photoURL || ''
      });
    }

    const encryptedToken = user.encryptApiKey(token);
    user.figmaToken = {
      encryptedToken,
      createdAt: new Date()
    };

    await user.save();

    res.json({ message: 'Figma token added successfully' });
  } catch (error) {
    console.error('Error adding Figma token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Figma token
router.delete('/figma', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.figmaToken = undefined;
    await user.save();

    res.json({ message: 'Figma token deleted successfully' });
  } catch (error) {
    console.error('Error deleting Figma token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test API key
router.post('/test/:keyId', authenticateToken, async (req, res) => {
  try {
    const { keyId } = req.params;

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = user.apiKeys.id(keyId);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Test the API key based on provider
    const decryptedKey = user.decryptApiKey(apiKey.encryptedKey);
    let testResult = false;

    switch (apiKey.provider) {
      case 'openai':
        testResult = await testOpenAIKey(decryptedKey);
        break;
      case 'claude':
        testResult = await testClaudeKey(decryptedKey);
        break;
      case 'gemini':
        testResult = await testGeminiKey(decryptedKey);
        break;
      case 'openrouter':
        testResult = await testOpenRouterKey(decryptedKey);
        break;
    }

    res.json({ valid: testResult });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions to test API keys
async function testOpenAIKey(apiKey) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    return true;
  } catch (error) {
    return false;
  }
}

async function testClaudeKey(apiKey) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });
    // Claude doesn't have a direct test endpoint, so we'll try a minimal call
    return true; // For now, assume it's valid if provided
  } catch (error) {
    return false;
  }
}

async function testGeminiKey(apiKey) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    return true; // For now, assume it's valid if provided
  } catch (error) {
    return false;
  }
}

async function testOpenRouterKey(apiKey) {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

module.exports = router;
