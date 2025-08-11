// src/middleware/auth.js
const { auth, firebaseInitialized } = require('../config/firebase');

const authenticateToken = async (req, res, next) => {
  try {
    // If Firebase is not initialized, create a mock user for development
    if (!firebaseInitialized) {
      req.user = {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        email_verified: true,
        name: 'Development User'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
    }
    
    next();
  } catch (error) {
    // Continue without user context if token is invalid
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
