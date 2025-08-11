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
  thumbnail: {
    type: String,
    default: null
  },
  subdomain: {
    type: String,
    unique: true,
    sparse: true
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

module.exports = mongoose.model('Project', projectSchema);
