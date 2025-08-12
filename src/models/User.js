// src/models/User.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['openai', 'gemini', 'claude', 'openrouter'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  encryptedKey: {
    type: String,
    required: true
  },
  models: [{
    type: String
  }],
  defaultModel: {
    type: String
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    default: ''
  },
  photoURL: {
    type: String,
    default: ''
  },
  profile: {
    firstName: String,
    lastName: String,
    company: String,
    website: String,
    bio: String
  },
  apiKeys: [apiKeySchema],
  figmaToken: {
    encryptedToken: String,
    createdAt: Date
  },
  preferences: {
    defaultAiProvider: {
      type: String,
      enum: ['openai', 'gemini', 'claude', 'openrouter'],
      default: 'openai'
    },
    codeStyle: {
      type: String,
      enum: ['react', 'vanilla', 'vue', 'angular'],
      default: 'react'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    }
  },
  learningData: {
    patterns: [{
      component: String,
      code: String,
      usage: Number,
      lastUsed: Date
    }],
    styles: [{
      property: String,
      value: String,
      context: String,
      usage: Number
    }],
    layouts: [{
      type: String,
      structure: Object,
      usage: Number
    }]
  },
  stats: {
    projectsCreated: { type: Number, default: 0 },
    totalBuilds: { type: Number, default: 0 },
    successfulBuilds: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Encryption helper methods
userSchema.methods.encryptApiKey = function(key) {
  try {
    const algorithm = 'aes-256-cbc';
    const secretKey = process.env.ENCRYPTION_KEY || 'your-secret-key-here-32-chars!!';
    
    // Ensure the secret key is exactly 32 bytes for AES-256
    const keyBuffer = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt API key');
  }
};

userSchema.methods.decryptApiKey = function(encryptedKey) {
  try {
    const algorithm = 'aes-256-cbc';
    const secretKey = process.env.ENCRYPTION_KEY || 'your-secret-key-here-32-chars!!';
    
    // Ensure the secret key is exactly 32 bytes for AES-256
    const keyBuffer = crypto.createHash('sha256').update(secretKey).digest();
    
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt API key');
  }
};

// Add API key method
userSchema.methods.addApiKey = function(provider, name, key, models = [], defaultModel = null) {
  // Remove existing default if this one is being set as default
  if (defaultModel) {
    this.apiKeys.forEach(apiKey => {
      if (apiKey.provider === provider) {
        apiKey.isDefault = false;
      }
    });
  }

  // Check if we already have 5 API keys
  if (this.apiKeys.length >= 5) {
    throw new Error('Maximum of 5 API keys allowed');
  }

  const encryptedKey = this.encryptApiKey(key);
  
  this.apiKeys.push({
    provider,
    name,
    encryptedKey,
    models,
    defaultModel,
    isDefault: !!defaultModel
  });
};

// Update learning data
userSchema.methods.addLearningPattern = function(component, code) {
  const existing = this.learningData.patterns.find(p => p.component === component);
  if (existing) {
    existing.usage++;
    existing.lastUsed = new Date();
    existing.code = code; // Update with latest code
  } else {
    this.learningData.patterns.push({
      component,
      code,
      usage: 1,
      lastUsed: new Date()
    });
  }
};

userSchema.methods.getLearningPatterns = function() {
  return this.learningData.patterns.sort((a, b) => b.usage - a.usage);
};

module.exports = mongoose.model('User', userSchema);
