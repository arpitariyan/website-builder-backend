// src/services/aiService.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
  async generateWebsiteCode(prompt, options = {}) {
    try {
      // First check Firebase for cached code
      const cachedCode = await this.checkCachedCode(prompt);
      if (cachedCode) {
        return cachedCode;
      }

      // Generate with OpenAI if not cached
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert web developer. Generate complete, production-ready code based on user requirements. 
                     Create both frontend and backend code with proper structure and best practices.`
          },
          {
            role: 'user',
            content: `Generate a complete website with the following requirements: ${prompt}. 
                     Frontend framework: ${options.frontend || 'React'}, 
                     Backend framework: ${options.backend || 'Node.js'}.
                     Include proper folder structure, components, and API endpoints.`
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      });

      const generatedCode = response.choices[0].message.content;
      
      // Cache the generated code in Firebase
      await this.cacheCode(prompt, generatedCode);
      
      return generatedCode;
    } catch (error) {
      console.error('AI Generation Error:', error);
      throw new Error('Failed to generate website code');
    }
  }

  async checkCachedCode(prompt) {
    try {
      const { db } = require('../config/firebase');
      const snapshot = await db.collection('cached_code').where('prompt', '==', prompt).get();
      
      if (!snapshot.empty) {
        return snapshot.docs[0].data().code;
      }
      return null;
    } catch (error) {
      console.error('Cache check error:', error);
      return null;
    }
  }

  async cacheCode(prompt, code) {
    try {
      const { db } = require('../config/firebase');
      await db.collection('cached_code').add({
        prompt,
        code,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  async analyzeFigmaDesign(figmaUrl) {
    // Implement Figma API integration
    // This would analyze the Figma design and extract components/layout
    try {
      const prompt = `Analyze this Figma design and generate corresponding React components: ${figmaUrl}`;
      return await this.generateWebsiteCode(prompt);
    } catch (error) {
      throw new Error('Failed to analyze Figma design');
    }
  }
}

module.exports = new AIService();
