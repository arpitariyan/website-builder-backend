// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // For development, we'll use a simple in-memory fallback
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/website-builder';
    
    await mongoose.connect(uri, {
      // Remove deprecated options that are no longer needed
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📁 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.warn('⚠️ MongoDB connection failed:', error.message);
    console.warn('🔧 Application will run with limited functionality');
    
    // Don't exit the process, allow the app to run without database
    // process.exit(1);
  }
};

module.exports = connectDB;
