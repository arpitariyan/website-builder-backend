// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { verifyToken, createUser, getCurrentUser, refreshToken } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Auth routes
router.post('/verify', verifyToken);
router.post('/signup', createUser);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/refresh', refreshToken);

module.exports = router;
