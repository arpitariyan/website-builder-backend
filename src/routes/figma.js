// src/routes/figma.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Process Figma design URL
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { figmaUrl } = req.body;

    if (!figmaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Figma URL is required'
      });
    }

    // Validate Figma URL format
    const figmaUrlPattern = /^https:\/\/www\.figma\.com\/(file|proto)\/[a-zA-Z0-9]+/;
    if (!figmaUrlPattern.test(figmaUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Figma URL format'
      });
    }

    // Extract file ID from URL
    const fileId = extractFigmaFileId(figmaUrl);
    
    // Mock processing result (in real implementation, would use Figma API)
    const processedResult = {
      fileId,
      name: 'Figma Design Import',
      components: generateMockComponents(),
      styles: generateMockStyles(),
      assets: generateMockAssets()
    };

    res.json({
      success: true,
      result: processedResult,
      message: 'Figma design processed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process Figma design',
      error: error.message
    });
  }
});

// Get Figma file information
router.get('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Mock file information (in real implementation, would use Figma API)
    const fileInfo = {
      id: fileId,
      name: 'Design File',
      thumbnail: `https://s3-alpha-sig.figma.com/img/${fileId}`,
      lastModified: new Date().toISOString(),
      version: '1.0',
      pages: [
        { id: 'page1', name: 'Desktop' },
        { id: 'page2', name: 'Mobile' }
      ]
    };

    res.json({
      success: true,
      file: fileInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get Figma file information',
      error: error.message
    });
  }
});

// Convert Figma components to code
router.post('/convert', authenticateToken, async (req, res) => {
  try {
    const { fileId, nodeId, format = 'react' } = req.body;

    if (!fileId || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'File ID and Node ID are required'
      });
    }

    // Mock code generation
    const generatedCode = generateCodeFromFigma(format, nodeId);

    res.json({
      success: true,
      code: generatedCode,
      format,
      message: 'Component converted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to convert Figma component',
      error: error.message
    });
  }
});

// Helper functions
function extractFigmaFileId(url) {
  const match = url.match(/\/file\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function generateMockComponents() {
  return [
    {
      id: 'header-comp',
      name: 'Header',
      type: 'FRAME',
      properties: {
        width: 1200,
        height: 80,
        backgroundColor: '#ffffff',
        borderRadius: 0
      }
    },
    {
      id: 'hero-comp',
      name: 'Hero Section',
      type: 'FRAME',
      properties: {
        width: 1200,
        height: 600,
        backgroundColor: '#007bff',
        borderRadius: 0
      }
    },
    {
      id: 'button-comp',
      name: 'CTA Button',
      type: 'FRAME',
      properties: {
        width: 200,
        height: 48,
        backgroundColor: '#28a745',
        borderRadius: 8
      }
    }
  ];
}

function generateMockStyles() {
  return {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      white: '#ffffff',
      dark: '#343a40'
    },
    typography: {
      h1: { fontSize: 48, fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: 36, fontWeight: 600, lineHeight: 1.3 },
      h3: { fontSize: 24, fontWeight: 600, lineHeight: 1.4 },
      body: { fontSize: 16, fontWeight: 400, lineHeight: 1.6 }
    },
    spacing: {
      xs: 8,
      sm: 16,
      md: 24,
      lg: 32,
      xl: 48
    }
  };
}

function generateMockAssets() {
  return [
    {
      id: 'logo',
      name: 'Company Logo',
      type: 'image',
      url: '/assets/logo.png',
      width: 120,
      height: 40
    },
    {
      id: 'hero-bg',
      name: 'Hero Background',
      type: 'image',
      url: '/assets/hero-bg.jpg',
      width: 1200,
      height: 600
    }
  ];
}

function generateCodeFromFigma(format, nodeId) {
  const codeTemplates = {
    react: `
import React from 'react';
import './Component.css';

const Component = () => {
  return (
    <div className="figma-component-${nodeId}">
      {/* Generated from Figma design */}
      <h2>Component Title</h2>
      <p>Component content goes here</p>
      <button className="cta-button">Call to Action</button>
    </div>
  );
};

export default Component;`,
    
    html: `
<div class="figma-component-${nodeId}">
  <!-- Generated from Figma design -->
  <h2>Component Title</h2>
  <p>Component content goes here</p>
  <button class="cta-button">Call to Action</button>
</div>`,
    
    vue: `
<template>
  <div class="figma-component-${nodeId}">
    <!-- Generated from Figma design -->
    <h2>Component Title</h2>
    <p>Component content goes here</p>
    <button class="cta-button">Call to Action</button>
  </div>
</template>

<script>
export default {
  name: 'FigmaComponent'
}
</script>

<style scoped>
/* Component styles */
</style>`
  };

  return codeTemplates[format] || codeTemplates.html;
}

module.exports = router;
