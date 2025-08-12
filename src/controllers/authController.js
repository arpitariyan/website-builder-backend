// src/controllers/authController.js
const { auth, firebaseInitialized } = require('../config/firebase');
const User = require('../models/User');

// Verify Firebase ID Token
const verifyToken = async (req, res) => {
  try {
    // For development when Firebase is not configured
    if (!firebaseInitialized) {
      return res.status(200).json({
        success: true,
        message: 'Development mode - Firebase not configured',
        user: {
          uid: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User',
          emailVerified: true
        }
      });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    
    // Create or update user in MongoDB
    let user = await User.findOne({ uid: decodedToken.uid });
    if (!user) {
      user = new User({
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email,
        photoURL: decodedToken.picture || ''
      });
      await user.save();
    } else {
      // Update user info if changed
      let shouldUpdate = false;
      if (user.email !== decodedToken.email) {
        user.email = decodedToken.email;
        shouldUpdate = true;
      }
      if (user.displayName !== (decodedToken.name || decodedToken.email)) {
        user.displayName = decodedToken.name || decodedToken.email;
        shouldUpdate = true;
      }
      if (user.photoURL !== (decodedToken.picture || '')) {
        user.photoURL = decodedToken.picture || '';
        shouldUpdate = true;
      }
      if (shouldUpdate) {
        user.stats.lastActive = new Date();
        await user.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Token verified successfully',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        emailVerified: decodedToken.email_verified || false
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Create user in database after Firebase registration
const createUser = async (req, res) => {
  try {
    if (!firebaseInitialized) {
      return res.status(200).json({
        success: true,
        message: 'Development mode - user created',
        user: {
          uid: 'dev-user-123',
          email: req.body.email || 'dev@example.com',
          displayName: req.body.displayName || 'Development User',
          emailVerified: true
        }
      });
    }

    const { token, userData } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    
    // Here you could save user data to your database
    // For now, we'll just return success
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || userData?.displayName || decodedToken.email,
        emailVerified: decodedToken.email_verified || false,
        photoURL: decodedToken.picture || null
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

// Get current user information
const getCurrentUser = async (req, res) => {
  try {
    // For development when Firebase is not configured
    if (!firebaseInitialized) {
      return res.status(200).json({
        success: true,
        user: {
          uid: 'dev-user-123',
          email: 'dev@example.com',
          displayName: 'Development User',
          emailVerified: true,
          photoURL: null
        }
      });
    }

    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.name || user.email,
        emailVerified: user.email_verified || false,
        photoURL: user.picture || null
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Refresh token (placeholder for Firebase token refresh)
const refreshToken = async (req, res) => {
  try {
    // For development
    if (!firebaseInitialized) {
      return res.status(200).json({
        success: true,
        message: 'Development mode - token refresh not needed',
        token: 'dev-token-123'
      });
    }

    // In a real implementation, you might handle custom token creation here
    res.status(200).json({
      success: true,
      message: 'Token refresh handled by client SDK'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  verifyToken,
  createUser,
  getCurrentUser,
  refreshToken
};
