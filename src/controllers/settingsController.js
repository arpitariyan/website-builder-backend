// src/controllers/settingsController.js

// Mock settings controller for basic functionality
const getUserSettings = async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    
    // Mock user data
    const mockUser = {
      firebaseUid,
      email: req.user.email,
      username: req.user.email?.split('@')[0] || 'user',
      displayName: req.user.name || req.user.email?.split('@')[0] || 'User',
      apiKeys: {
        openai: {
          isActive: false,
          hasKey: false,
          lastUsed: null
        },
        figma: {
          isActive: false,
          hasKey: false,
          lastUsed: null
        }
      },
      codeGeneration: {
        preferDatabase: true,
        fallbackToAPI: true,
        cacheGeneratedCode: true
      },
      usage: {
        totalCodeGenerations: 0,
        projectsCreated: 0,
        templatesUsed: 0
      },
      createdAt: new Date(),
      lastActive: new Date()
    };
    
    res.json({
      success: true,
      user: mockUser
    });
  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user settings'
    });
  }
};

// Update user profile (mock)
const updateUserProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Profile updated successfully (mock)',
      user: { ...req.body }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Update password (mock)
const updatePassword = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Password update initiated (mock)'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password'
    });
  }
};

// Save API keys (mock)
const saveAPIKey = async (req, res) => {
  try {
    const { type, apiKey, isActive } = req.body;
    
    res.json({
      success: true,
      message: `${type.toUpperCase()} API key saved successfully (mock)`,
      apiKeyStatus: {
        type,
        isActive,
        hasKey: !!apiKey
      }
    });
  } catch (error) {
    console.error('Save API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save API key'
    });
  }
};

// Update code generation preferences (mock)
const updateCodeGenPreferences = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Code generation preferences updated successfully (mock)',
      preferences: req.body
    });
  } catch (error) {
    console.error('Update code gen preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};

// Update Figma integration settings (mock)
const updateFigmaSettings = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Figma settings updated successfully (mock)',
      figmaSettings: req.body
    });
  } catch (error) {
    console.error('Update Figma settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Figma settings'
    });
  }
};

// Test API key functionality (mock)
const testAPIKey = async (req, res) => {
  try {
    const { type } = req.body;
    
    res.json({
      success: true,
      message: `${type.toUpperCase()} API key test successful (mock)`,
      isValid: true
    });
  } catch (error) {
    console.error('Test API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test API key'
    });
  }
};

// Get usage statistics (mock)
const getUsageStats = async (req, res) => {
  try {
    const stats = {
      user: {
        totalCodeGenerations: 0,
        projectsCreated: 0,
        templatesUsed: 0
      },
      subscription: {
        tier: 'free'
      },
      codeTemplates: {
        totalTemplates: 0,
        totalUsage: 0,
        avgRating: 0
      }
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics'
    });
  }
};

module.exports = {
  getUserSettings,
  updateUserProfile,
  updatePassword,
  saveAPIKey,
  updateCodeGenPreferences,
  updateFigmaSettings,
  testAPIKey,
  getUsageStats
};
