// src/models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  userId: {
    type: String,
    required: true
  },
  templateId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private'
  },
  thumbnail: {
    type: String,
    default: null
  },
  subdomain: {
    type: String,
    unique: true,
    sparse: true
  },
  figmaData: {
    figmaUrl: String,
    fileKey: String,
    nodeId: String,
    designData: Object,
    lastSync: Date
  },
  aiGeneration: {
    provider: String,
    model: String,
    prompt: String,
    generatedAt: Date,
    tokensUsed: Number,
    learningApplied: Boolean
  },
  content: {
    html: {
      type: String,
      default: ''
    },
    css: {
      type: String,
      default: ''
    },
    js: {
      type: String,
      default: ''
    },
    components: [{
      id: String,
      type: String,
      props: mongoose.Schema.Types.Mixed,
      styles: mongoose.Schema.Types.Mixed,
      position: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    }],
    pages: [{
      id: String,
      name: String,
      path: String,
      components: [String]
    }]
  },
  settings: {
    responsive: {
      desktop: mongoose.Schema.Types.Mixed,
      tablet: mongoose.Schema.Types.Mixed,
      mobile: mongoose.Schema.Types.Mixed
    },
    seo: {
      title: String,
      description: String,
      keywords: [String]
    },
    theme: {
      primaryColor: String,
      secondaryColor: String,
      fontFamily: String,
      fontSize: String
    }
  },
  versions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    timestamp: Date,
    description: String
  }],
  debugging: {
    errors: [{
      message: String,
      stack: String,
      fixed: Boolean,
      fixedAt: Date,
      timestamp: Date
    }],
    warnings: [{
      message: String,
      severity: String,
      timestamp: Date
    }],
    performance: {
      buildTime: Number,
      codeSize: Number,
      loadTime: Number
    }
  },
  analytics: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    lastViewed: Date
  },
  publishedUrl: {
    type: String,
    default: null
  },
  lastSaved: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ subdomain: 1 });
projectSchema.index({ visibility: 1, status: 1 });

// Add method to track errors
projectSchema.methods.addError = function(error) {
  this.debugging.errors.push({
    message: error.message,
    stack: error.stack,
    fixed: false,
    timestamp: new Date()
  });
};

// Add method to mark error as fixed
projectSchema.methods.fixError = function(errorId) {
  const error = this.debugging.errors.id(errorId);
  if (error) {
    error.fixed = true;
    error.fixedAt = new Date();
  }
};

module.exports = mongoose.model('Project', projectSchema);
