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
  category: {
    type: String,
    enum: ['portfolio', 'landing-page', 'e-commerce', 'business', 'blog', 'other'],
    default: 'other'
  },
  backendRequired: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'planning', 'analyzing', 'ready', 'generating', 'published', 'archived'],
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
  uploadedFiles: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    parsedContent: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  figmaData: {
    figmaUrl: String,
    fileKey: String,
    nodeId: String,
    designData: Object,
    flowAnalysis: [{
      flowName: String,
      screens: [Object],
      connections: [Object]
    }],
    lastSync: Date
  },
  aiAnalysis: {
    prompt: String,
    generatedPrompt: String,
    analysisData: Object,
    lastGenerated: Date,
    version: { type: Number, default: 1 }
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
  },
  // Enhanced project fields
  enhanced: {
    type: Boolean,
    default: false
  },
  projectType: {
    type: String,
    enum: ['website', 'web-app', 'mobile-app', 'api', 'desktop-app', 'other'],
    default: 'website'
  },
  techStack: [{
    type: String
  }],
  features: [{
    type: String
  }],
  requirements: {
    type: String,
    default: ''
  },
  attachments: {
    documentation: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      uploadedAt: { type: Date, default: Date.now }
    }],
    designFiles: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      uploadedAt: { type: Date, default: Date.now }
    }]
  },
  generatedFiles: {
    type: Map,
    of: {
      content: String,
      type: String,
      generatedAt: { type: Date, default: Date.now },
      prompt: String,
      provider: String,
      tokensUsed: Number
    },
    default: new Map()
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
