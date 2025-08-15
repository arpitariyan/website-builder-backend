// src/services/aiOrchestrator.js
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');
const User = require('../models/User');
const aiKnowledgeBase = require('./aiKnowledgeBase');

class AIOrchestrator {
  constructor() {
    this.providers = {
      openai: this.callOpenAI.bind(this),
      gemini: this.callGemini.bind(this),
      claude: this.callClaude.bind(this),
      deepseek: this.callDeepSeek.bind(this),
      openrouter: this.callOpenRouter.bind(this)
    };
    
    this.fallbackOrder = ['openai', 'gemini', 'claude', 'deepseek', 'openrouter'];
  }

  // Main AI generation method with knowledge base integration
  async generateCode(userId, projectData, request) {
    try {
      console.log('Starting AI code generation with knowledge base lookup...');
      
      // Step 1: Search knowledge base for similar code
      const knowledgeResults = await this.searchKnowledgeBase(userId, request, projectData);
      
      // Step 2: If good matches found, adapt existing code
      if (knowledgeResults.length > 0 && knowledgeResults[0].similarity > 0.7) {
        console.log('High similarity match found, adapting existing code...');
        return await this.adaptExistingCode(userId, projectData, request, knowledgeResults[0]);
      }
      
      // Step 3: No good matches, generate new code with AI
      console.log('No high-similarity matches, generating new code...');
      const generatedCode = await this.generateNewCode(userId, projectData, request, knowledgeResults);
      
      // Step 4: Store the new code in knowledge base
      await this.storeGeneratedCode(userId, projectData._id, generatedCode, request);
      
      return generatedCode;
    } catch (error) {
      console.error('AI Orchestrator error:', error);
      throw error;
    }
  }

  // Search knowledge base for relevant code
  async searchKnowledgeBase(userId, request, projectData) {
    try {
      const searchQuery = `${request.description || ''} ${request.type} ${projectData.category} ${projectData.frontendTech || 'react'}`;
      
      const filters = {
        userId,
        codeType: request.type,
        stack: projectData.frontendTech || 'react',
        category: projectData.category
      };
      
      return await aiKnowledgeBase.searchSimilarCode(searchQuery, filters);
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }
  }

  // Adapt existing code from knowledge base
  async adaptExistingCode(userId, projectData, request, knowledgeEntry) {
    try {
      const user = await User.findOne({ uid: userId });
      const provider = user.preferences?.defaultAiProvider || 'openai';
      const apiKey = this.getUserApiKey(user, provider);
      
      if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
      }

      const adaptationPrompt = `
Adapt this existing code for the new requirements:

EXISTING CODE:
${knowledgeEntry.code}

ORIGINAL CONTEXT:
${knowledgeEntry.description}

NEW REQUIREMENTS:
${request.description || 'Update code as needed'}

PROJECT CONTEXT:
- Name: ${projectData.name}
- Category: ${projectData.category}
- Stack: ${projectData.frontendTech || 'react'}

Please adapt the existing code to meet the new requirements while maintaining best practices.
Return only the adapted code, no explanations.
`;

      const result = await this.callProvider(provider, apiKey, adaptationPrompt, {
        type: 'code_adaptation',
        maxTokens: 3000
      });

      // Update the knowledge entry metrics
      await aiKnowledgeBase.updateCodeMetrics(knowledgeEntry._id, true);

      return {
        files: this.parseCodeResponse(result.content, request.type),
        source: 'adapted',
        originalEntry: knowledgeEntry._id,
        provider: result.provider,
        tokensUsed: result.tokensUsed
      };
    } catch (error) {
      console.error('Code adaptation error:', error);
      // Fall back to generating new code
      return await this.generateNewCode(userId, projectData, request, []);
    }
  }

  // Generate completely new code using AI
  async generateNewCode(userId, projectData, request, knowledgeContext = []) {
    try {
      const user = await User.findOne({ uid: userId });
      const provider = user.preferences?.defaultAiProvider || 'openai';
      let apiKey = this.getUserApiKey(user, provider);
      
      // Try fallback providers if primary fails
      let currentProvider = provider;
      for (const fallbackProvider of this.fallbackOrder) {
        apiKey = this.getUserApiKey(user, fallbackProvider);
        if (apiKey) {
          currentProvider = fallbackProvider;
          break;
        }
      }
      
      if (!apiKey) {
        throw new Error('No available AI provider API keys found');
      }

      const generationPrompt = this.buildGenerationPrompt(projectData, request, knowledgeContext);
      
      const result = await this.callProvider(currentProvider, apiKey, generationPrompt, {
        type: 'code_generation',
        maxTokens: 4000
      });

      return {
        files: this.parseCodeResponse(result.content, request.type),
        source: 'generated',
        provider: result.provider,
        tokensUsed: result.tokensUsed
      };
    } catch (error) {
      console.error('New code generation error:', error);
      throw error;
    }
  }

  // Build comprehensive generation prompt
  buildGenerationPrompt(projectData, request, knowledgeContext) {
    let prompt = `Generate high-quality code for a web development project.

PROJECT DETAILS:
- Name: ${projectData.name}
- Description: ${projectData.description}
- Category: ${projectData.category}
- Technology Stack: ${projectData.frontendTech || 'react'}
- Backend Required: ${projectData.backendRequired ? 'Yes' : 'No'}

REQUEST:
- Type: ${request.type}
- Description: ${request.description || 'Generate as specified'}
- Component: ${request.component || 'general'}

`;

    // Add knowledge context if available
    if (knowledgeContext.length > 0) {
      prompt += `SIMILAR CODE EXAMPLES (for reference):
`;
      knowledgeContext.slice(0, 3).forEach((entry, index) => {
        prompt += `${index + 1}. ${entry.description}
Similarity: ${(entry.similarity * 100).toFixed(1)}%

`;
      });
    }

    // Add specific requirements based on request type
    if (request.type === 'full-project') {
      prompt += `
REQUIREMENTS:
1. Generate a complete project structure
2. Include proper file organization
3. Add necessary dependencies
4. Implement responsive design
5. Include proper error handling
6. Add loading states
7. Use modern best practices
8. Include proper TypeScript/JSX syntax

STRUCTURE NEEDED:
- Main App component
- Routing setup
- Component organization
- Styling (CSS/Tailwind)
- Package.json configuration
`;
    }

    prompt += `
Return the code in a structured format with clear file paths.
Use modern React patterns, hooks, and best practices.
Ensure all code is production-ready and well-commented.
`;

    return prompt;
  }

  // Store generated code in knowledge base
  async storeGeneratedCode(userId, projectId, generatedCode, request) {
    try {
      if (generatedCode.files) {
        for (const [filePath, fileData] of Object.entries(generatedCode.files)) {
          await aiKnowledgeBase.storeCode(projectId, userId, {
            code: fileData.content,
            description: `${request.type}: ${filePath} - ${request.description || ''}`,
            codeType: request.type,
            metadata: {
              filePath,
              language: fileData.language,
              stack: request.stack || 'react',
              category: request.category
            }
          });
        }
      }
    } catch (error) {
      console.error('Error storing generated code:', error);
    }
  }

  // Parse AI response into structured file format
  parseCodeResponse(content, type) {
    const files = {};
    
    try {
      // Try to extract code blocks with file paths
      const codeBlockRegex = /```(?:(\w+)\s*\n)?([\s\S]*?)```/g;
      const filePathRegex = /\/\/\s*(?:File:|Path:)?\s*([^\n]+)/i;
      
      let match;
      let fileIndex = 0;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || 'javascript';
        const code = match[2].trim();
        
        // Try to extract file path from comments
        const pathMatch = filePathRegex.exec(code);
        let filePath;
        
        if (pathMatch) {
          filePath = pathMatch[1].trim();
        } else {
          // Generate default file path based on type and language
          filePath = this.generateDefaultFilePath(type, language, fileIndex);
        }
        
        files[filePath] = {
          content: code,
          language: this.mapLanguage(language, filePath)
        };
        
        fileIndex++;
      }
      
      // If no code blocks found, treat entire content as single file
      if (Object.keys(files).length === 0) {
        const defaultPath = this.generateDefaultFilePath(type, 'javascript', 0);
        files[defaultPath] = {
          content: content,
          language: 'javascript'
        };
      }
    } catch (error) {
      console.error('Error parsing code response:', error);
      // Fallback: create a single file with the content
      files['App.jsx'] = {
        content: content,
        language: 'javascript'
      };
    }
    
    return files;
  }

  // Generate default file paths
  generateDefaultFilePath(type, language, index) {
    const pathMappings = {
      'full-project': ['src/App.jsx', 'src/index.js', 'public/index.html', 'package.json'],
      'component': [`src/components/Component${index}.jsx`],
      'service': [`src/services/service${index}.js`],
      'route': [`src/routes/route${index}.js`]
    };
    
    const paths = pathMappings[type] || [`src/file${index}.${this.getExtension(language)}`];
    return paths[index] || `src/file${index}.${this.getExtension(language)}`;
  }

  // Map language to file extension
  getExtension(language) {
    const extensions = {
      'javascript': 'js',
      'jsx': 'jsx',
      'typescript': 'ts',
      'tsx': 'tsx',
      'html': 'html',
      'css': 'css',
      'json': 'json'
    };
    return extensions[language] || 'js';
  }

  // Map file extension to Monaco editor language
  mapLanguage(detectedLang, filePath) {
    const ext = filePath.split('.').pop();
    const langMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown'
    };
    return langMap[ext] || detectedLang || 'javascript';
  }

  // Get user's API key for provider
  getUserApiKey(user, provider) {
    return user.apiKeys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`];
  }

  // Call specific AI provider
  async callProvider(provider, apiKey, prompt, options = {}) {
    const providerFunction = this.providers[provider];
    if (!providerFunction) {
      throw new Error(`Provider ${provider} not supported`);
    }
    
    return await providerFunction(apiKey, prompt, options);
  }

  // OpenAI API call
  async callOpenAI(apiKey, prompt, options) {
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 3000,
      temperature: 0.7
    });
    
    return {
      content: response.choices[0].message.content,
      provider: 'openai',
      tokensUsed: response.usage.total_tokens
    };
  }

  // Google Gemini API call
  async callGemini(apiKey, prompt, options) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return {
      content: response.text(),
      provider: 'gemini',
      tokensUsed: 0 // Gemini doesn't provide token count in response
    };
  }

  // Anthropic Claude API call
  async callClaude(apiKey, prompt, options) {
    const anthropic = new Anthropic({ apiKey });
    
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: options.maxTokens || 3000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    return {
      content: response.content[0].text,
      provider: 'claude',
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    };
  }

  // DeepSeek API call
  async callDeepSeek(apiKey, prompt, options) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-coder',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 3000,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      provider: 'deepseek',
      tokensUsed: data.usage.total_tokens
    };
  }

  // OpenRouter API call
  async callOpenRouter(apiKey, prompt, options) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Title': 'Website Builder AI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 3000,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      provider: 'openrouter',
      tokensUsed: data.usage.total_tokens
    };
  }

  // Get knowledge base statistics
  async getKnowledgeStats(userId) {
    return await aiKnowledgeBase.getKnowledgeStats(userId);
  }
}

module.exports = new AIOrchestrator();
