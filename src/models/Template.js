// src/models/Template.js
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['business', 'portfolio', 'blog', 'ecommerce', 'landing', 'personal', 'other']
  },
  thumbnail: {
    type: String,
    required: true
  },
  previewUrl: {
    type: String,
    default: null
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  tags: [String],
  content: {
    html: {
      type: String,
      required: true
    },
    css: {
      type: String,
      required: true
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
    }]
  },
  settings: {
    responsive: {
      desktop: mongoose.Schema.Types.Mixed,
      tablet: mongoose.Schema.Types.Mixed,
      mobile: mongoose.Schema.Types.Mixed
    },
    theme: {
      primaryColor: String,
      secondaryColor: String,
      fontFamily: String,
      fontSize: String
    }
  },
  usageCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ tags: 1 });

module.exports = mongoose.model('Template', templateSchema);
