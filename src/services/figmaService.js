// src/services/figmaService.js
const fetch = require('node-fetch');
const User = require('../models/User');

class FigmaService {
  constructor() {
    this.baseUrl = 'https://api.figma.com/v1';
  }

  async getFigmaToken(userId) {
    const user = await User.findOne({ uid: userId });
    if (!user || !user.figmaToken) {
      throw new Error('No Figma token found for user');
    }
    
    return user.decryptApiKey(user.figmaToken.encryptedToken);
  }

  async extractFileInfo(figmaUrl) {
    // Extract file key and node ID from Figma URL
    const urlPatterns = [
      /figma\.com\/file\/([a-zA-Z0-9]+)\/[^\/]*(\?.*node-id=([^&]+))?/,
      /figma\.com\/design\/([a-zA-Z0-9]+)\/[^\/]*(\?.*node-id=([^&]+))?/
    ];

    for (const pattern of urlPatterns) {
      const match = figmaUrl.match(pattern);
      if (match) {
        return {
          fileKey: match[1],
          nodeId: match[3] ? match[3].replace(/%3A/g, ':') : null
        };
      }
    }

    throw new Error('Invalid Figma URL format');
  }

  async getFileData(userId, figmaUrl) {
    try {
      const token = await this.getFigmaToken(userId);
      const { fileKey, nodeId } = await this.extractFileInfo(figmaUrl);

      // Get file information
      const fileResponse = await fetch(`${this.baseUrl}/files/${fileKey}`, {
        headers: {
          'X-Figma-Token': token
        }
      });

      if (!fileResponse.ok) {
        throw new Error(`Figma API error: ${fileResponse.status}`);
      }

      const fileData = await fileResponse.json();

      // If specific node is requested, get its data
      let nodeData = null;
      if (nodeId) {
        const nodeResponse = await fetch(`${this.baseUrl}/files/${fileKey}/nodes?ids=${nodeId}`, {
          headers: {
            'X-Figma-Token': token
          }
        });

        if (nodeResponse.ok) {
          const nodeResult = await nodeResponse.json();
          nodeData = nodeResult.nodes[nodeId];
        }
      }

      return {
        file: fileData,
        node: nodeData,
        fileKey,
        nodeId
      };

    } catch (error) {
      console.error('Figma service error:', error);
      throw error;
    }
  }

  async generateCodeFromDesign(userId, figmaUrl, options = {}) {
    try {
      const designData = await this.getFileData(userId, figmaUrl);
      const analysisResult = this.analyzeDesign(designData);
      
      return {
        designData,
        analysis: analysisResult,
        recommendations: this.getCodeRecommendations(analysisResult)
      };

    } catch (error) {
      console.error('Code generation from design failed:', error);
      throw error;
    }
  }

  analyzeDesign(designData) {
    const analysis = {
      components: [],
      layout: 'flex',
      colors: new Set(),
      fonts: new Set(),
      spacing: new Set(),
      dimensions: {}
    };

    // Analyze the design structure
    const traverseNode = (node, depth = 0) => {
      if (!node) return;

      // Extract colors
      if (node.fills) {
        node.fills.forEach(fill => {
          if (fill.type === 'SOLID' && fill.color) {
            const color = this.rgbToHex(fill.color);
            analysis.colors.add(color);
          }
        });
      }

      // Extract text styles
      if (node.style) {
        if (node.style.fontFamily) {
          analysis.fonts.add(node.style.fontFamily);
        }
      }

      // Extract dimensions
      if (node.absoluteBoundingBox) {
        analysis.dimensions = {
          width: node.absoluteBoundingBox.width,
          height: node.absoluteBoundingBox.height
        };
      }

      // Identify component types
      if (node.type === 'FRAME' || node.type === 'GROUP') {
        analysis.components.push({
          type: this.identifyComponentType(node),
          name: node.name,
          bounds: node.absoluteBoundingBox,
          children: node.children ? node.children.length : 0
        });
      }

      // Traverse children
      if (node.children) {
        node.children.forEach(child => traverseNode(child, depth + 1));
      }
    };

    // Start analysis from the target node or document
    const startNode = designData.node?.document || designData.file.document;
    traverseNode(startNode);

    // Convert sets to arrays
    analysis.colors = Array.from(analysis.colors);
    analysis.fonts = Array.from(analysis.fonts);
    analysis.spacing = Array.from(analysis.spacing);

    return analysis;
  }

  identifyComponentType(node) {
    const name = node.name.toLowerCase();
    
    if (name.includes('button')) return 'button';
    if (name.includes('header') || name.includes('nav')) return 'header';
    if (name.includes('footer')) return 'footer';
    if (name.includes('card')) return 'card';
    if (name.includes('modal') || name.includes('popup')) return 'modal';
    if (name.includes('form')) return 'form';
    if (name.includes('input')) return 'input';
    if (name.includes('sidebar')) return 'sidebar';
    if (name.includes('hero')) return 'hero';
    
    return 'container';
  }

  getCodeRecommendations(analysis) {
    const recommendations = {
      framework: 'react',
      styling: 'tailwind',
      layout: analysis.layout,
      components: []
    };

    // Generate component recommendations
    analysis.components.forEach(comp => {
      recommendations.components.push({
        name: comp.name,
        type: comp.type,
        props: this.generatePropsForComponent(comp),
        styling: this.generateStylingForComponent(comp, analysis)
      });
    });

    return recommendations;
  }

  generatePropsForComponent(component) {
    const props = {};
    
    switch (component.type) {
      case 'button':
        props.variant = 'primary';
        props.size = 'medium';
        props.disabled = false;
        break;
      case 'input':
        props.type = 'text';
        props.placeholder = 'Enter text...';
        props.required = false;
        break;
      case 'card':
        props.elevation = 'medium';
        props.padding = 'medium';
        break;
    }

    return props;
  }

  generateStylingForComponent(component, analysis) {
    const styles = [];

    // Add layout styles
    if (component.bounds) {
      styles.push(`w-[${Math.round(component.bounds.width)}px]`);
      styles.push(`h-[${Math.round(component.bounds.height)}px]`);
    }

    // Add color styles if available
    if (analysis.colors.length > 0) {
      styles.push(`bg-[${analysis.colors[0]}]`);
    }

    return styles.join(' ');
  }

  rgbToHex(rgb) {
    const toHex = (value) => {
      const hex = Math.round(value * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  async getImages(userId, figmaUrl) {
    try {
      const token = await this.getFigmaToken(userId);
      const { fileKey, nodeId } = await this.extractFileInfo(figmaUrl);

      // Get image URLs
      const imageResponse = await fetch(`${this.baseUrl}/images/${fileKey}?ids=${nodeId}&format=png&scale=2`, {
        headers: {
          'X-Figma-Token': token
        }
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to get images: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      return imageData.images;

    } catch (error) {
      console.error('Error getting Figma images:', error);
      throw error;
    }
  }
}

module.exports = new FigmaService();