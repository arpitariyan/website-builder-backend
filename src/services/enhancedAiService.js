// src/services/enhancedAiService.js
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');
const User = require('../models/User');

class EnhancedAiService {
  constructor() {
    this.providers = {
      openai: this.callOpenAI.bind(this),
      gemini: this.callGemini.bind(this),
      claude: this.callClaude.bind(this),
      openrouter: this.callOpenRouter.bind(this)
    };
  }

  async generateProjectAnalysis(userId, projectData) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user) {
        throw new Error('User not found');
      }

      const provider = user.preferences?.defaultAiProvider || 'openai';
      const apiKey = this.getUserApiKey(user, provider);
      
      if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
      }

      const analysisPrompt = this.buildProjectAnalysisPrompt(projectData);
      
      const result = await this.callProvider(provider, apiKey, analysisPrompt, {
        type: 'analysis',
        maxTokens: 2000
      });

      return {
        analysis: this.parseAnalysisResult(result.content),
        prompt: this.generateDevelopmentPrompt(projectData, result.content),
        provider: result.provider,
        tokensUsed: result.tokensUsed
      };
    } catch (error) {
      console.error('Project analysis failed:', error);
      throw error;
    }
  }

  buildProjectAnalysisPrompt(data) {
    let prompt = `Please analyze this web development project and provide a comprehensive development plan.

Project Details:
- Name: ${data.name}
- Description: ${data.description}
- Category: ${data.category}
- Backend Required: ${data.backendRequired ? 'Yes' : 'No'}

`;

    if (data.uploadedContent) {
      prompt += `Additional Documentation:
${data.uploadedContent}

`;
    }

    if (data.figmaData) {
      prompt += `Design Information:
- Figma design is available with detailed mockups
`;
      if (data.figmaFlows && data.figmaFlows.length > 0) {
        prompt += `- Design flows analyzed: ${data.figmaFlows.map(f => f.flowName).join(', ')}
`;
      }
      prompt += '\n';
    }

    prompt += `Please provide:
1. Technical architecture recommendation
2. Key features and functionality to implement
3. Technology stack suggestions (React, Vue, Angular, etc.)
4. UI/UX considerations
5. Development timeline estimate
6. Potential challenges and solutions

Format your response as a structured analysis.`;

    return prompt;
  }

  parseAnalysisResult(content) {
    try {
      // Extract structured information from AI response
      const analysis = {
        architecture: this.extractSection(content, 'architecture'),
        features: this.extractSection(content, 'features'),
        techStack: this.extractSection(content, 'technology|tech stack'),
        uiUx: this.extractSection(content, 'ui/ux|design'),
        timeline: this.extractSection(content, 'timeline'),
        challenges: this.extractSection(content, 'challenges')
      };

      return analysis;
    } catch (error) {
      console.warn('Failed to parse analysis result:', error);
      return { raw: content };
    }
  }

  extractSection(content, sectionPattern) {
    const regex = new RegExp(`(?:^|\\n)\\d*\\.?\\s*(?:${sectionPattern})[:\\s]*([\\s\\S]*?)(?=\\n\\d+\\.|\\n[A-Z]|$)`, 'im');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  generateDevelopmentPrompt(projectData, analysisContent) {
    let prompt = `Create a ${projectData.backendRequired ? 'full-stack' : 'frontend'} web application with the following specifications:

Project: ${projectData.name}
Category: ${projectData.category}

Requirements:
${projectData.description}

`;

    if (projectData.uploadedContent) {
      prompt += `Additional Context:
${projectData.uploadedContent}

`;
    }

    if (analysisContent) {
      prompt += `Development Analysis:
${analysisContent}

`;
    }

    const techStack = this.getTechStackForCategory(projectData.category, projectData.backendRequired);
    
    prompt += `Technical Requirements:
- Use ${techStack.frontend} for the frontend
`;

    if (projectData.backendRequired) {
      prompt += `- Use ${techStack.backend} for the backend
- Include database integration
- Implement authentication if needed
`;
    }

    prompt += `- Ensure responsive design for all screen sizes
- Follow modern web development best practices
- Include proper error handling
- Optimize for performance

`;

    if (projectData.figmaData) {
      prompt += `Design Requirements:
- Follow the provided Figma design closely
- Maintain design consistency across all components
- Implement interactive elements as shown in the design
`;
      
      if (projectData.figmaFlows) {
        prompt += `- Implement the following user flows: ${projectData.figmaFlows.map(f => f.flowName).join(', ')}
`;
      }
      prompt += '\n';
    }

    prompt += `Output Requirements:
- Provide complete, production-ready code
- Include proper file structure
- Add comprehensive comments
- Ensure code is modular and maintainable

Generate the complete application code now.`;

    return prompt;
  }

  getTechStackForCategory(category, backendRequired) {
    const stacks = {
      'portfolio': {
        frontend: 'React with Tailwind CSS',
        backend: 'Node.js with Express'
      },
      'landing-page': {
        frontend: 'React with Tailwind CSS',
        backend: 'Node.js with Express'
      },
      'e-commerce': {
        frontend: 'React with Tailwind CSS and Redux',
        backend: 'Node.js with Express and MongoDB'
      },
      'business': {
        frontend: 'React with Tailwind CSS',
        backend: 'Node.js with Express and MongoDB'
      },
      'blog': {
        frontend: 'React with Tailwind CSS',
        backend: 'Node.js with Express and MongoDB'
      },
      'other': {
        frontend: 'React with Tailwind CSS',
        backend: 'Node.js with Express'
      }
    };

    return stacks[category] || stacks.other;
  }

  async generateCode(userId, prompt, options = {}) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user) {
        throw new Error('User not found');
      }

      // First, try to use learning patterns
      const learningResult = await this.tryLearningPatterns(user, prompt);
      if (learningResult && options.useLearning !== false) {
        return {
          code: learningResult,
          provider: 'learning',
          tokensUsed: 0
        };
      }

      // Get preferred provider or fallback
      const provider = options.provider || user.preferences?.defaultAiProvider || 'openai';
      const apiKey = this.getUserApiKey(user, provider);
      
      if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
      }

      // Generate code using AI
      const result = await this.callProvider(provider, apiKey, prompt, options);
      
      // Store learning pattern
      if (result.code && options.component) {
        user.addLearningPattern(options.component, result.code);
        await user.save();
      }

      return result;

    } catch (error) {
      console.error('AI generation failed:', error);
      
      // Try fallback providers
      return await this.tryFallbackProviders(userId, prompt, options);
    }
  }

  async tryLearningPatterns(user, prompt) {
    const patterns = user.getLearningPatterns();
    
    // Simple pattern matching - in production, use more sophisticated NLP
    const keywords = prompt.toLowerCase().split(' ');
    
    for (const pattern of patterns) {
      const patternKeywords = pattern.component.toLowerCase().split(/[-_]/);
      const matches = keywords.filter(k => patternKeywords.includes(k));
      
      if (matches.length > 0) {
        // Modify the pattern based on the new requirements
        return this.adaptPattern(pattern.code, prompt);
      }
    }
    
    return null;
  }

  adaptPattern(baseCode, prompt) {
    // Simple adaptation - replace common patterns
    let adaptedCode = baseCode;
    
    // Extract colors, sizes, etc. from prompt and apply them
    const colorMatch = prompt.match(/color[:\s]+([#\w]+)/i);
    if (colorMatch) {
      adaptedCode = adaptedCode.replace(/#[0-9a-fA-F]{6}/g, colorMatch[1]);
    }
    
    const sizeMatch = prompt.match(/size[:\s]+(\d+)/i);
    if (sizeMatch) {
      adaptedCode = adaptedCode.replace(/\d+px/g, `${sizeMatch[1]}px`);
    }
    
    return adaptedCode;
  }

  getUserApiKey(user, provider) {
    const apiKeyData = user.apiKeys.find(key => key.provider === provider);
    return apiKeyData ? user.decryptApiKey(apiKeyData.encryptedKey) : null;
  }

  async callProvider(provider, apiKey, prompt, options) {
    const providerFunction = this.providers[provider];
    if (!providerFunction) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return await providerFunction(apiKey, prompt, options);
  }

  async callOpenAI(apiKey, prompt, options = {}) {
    const openai = new OpenAI({ apiKey });
    
    const model = options.model || 'gpt-4';
    const systemPrompt = this.getSystemPrompt(options.type || 'component');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: options.maxTokens || 2000,
      temperature: 0.7
    });

    return {
      code: this.extractCode(response.choices[0].message.content),
      provider: 'openai',
      model,
      tokensUsed: response.usage.total_tokens
    };
  }

  async callGemini(apiKey, prompt, options = {}) {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: options.model || 'gemini-pro' 
    });

    const systemPrompt = this.getSystemPrompt(options.type || 'component');
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;

    return {
      code: this.extractCode(response.text()),
      provider: 'gemini',
      model: options.model || 'gemini-pro',
      tokensUsed: response.text().length // Approximate
    };
  }

  async callClaude(apiKey, prompt, options = {}) {
    const anthropic = new Anthropic({ apiKey });
    
    const model = options.model || 'claude-3-sonnet-20240229';
    const systemPrompt = this.getSystemPrompt(options.type || 'component');

    const response = await anthropic.messages.create({
      model,
      max_tokens: options.maxTokens || 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return {
      code: this.extractCode(response.content[0].text),
      provider: 'claude',
      model,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    };
  }

  async callOpenRouter(apiKey, prompt, options = {}) {
    const model = options.model || 'openai/gpt-4';
    const systemPrompt = this.getSystemPrompt(options.type || 'component');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Website Builder AI'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    return {
      code: this.extractCode(data.choices[0].message.content),
      provider: 'openrouter',
      model,
      tokensUsed: data.usage?.total_tokens || 0
    };
  }

  async tryFallbackProviders(userId, prompt, options) {
    const user = await User.findOne({ uid: userId });
    const availableProviders = user.apiKeys.map(key => key.provider);
    
    for (const provider of availableProviders) {
      if (provider !== options.provider) {
        try {
          const apiKey = this.getUserApiKey(user, provider);
          return await this.callProvider(provider, apiKey, prompt, { ...options, provider });
        } catch (error) {
          console.error(`Fallback provider ${provider} failed:`, error);
          continue;
        }
      }
    }
    
    throw new Error('All AI providers failed');
  }

  getSystemPrompt(type) {
    const prompts = {
      component: `You are an expert React developer and UI designer. Generate clean, modern, and responsive React components using Tailwind CSS. 
      
Rules:
- Return only the JSX code wrapped in a React component
- Use Tailwind CSS for styling
- Make components responsive and accessible
- Include proper TypeScript types if requested
- Use modern React patterns (hooks, functional components)
- Ensure code is production-ready and follows best practices`,

      page: `You are an expert web developer. Generate complete, responsive web pages using React and Tailwind CSS.

Rules:
- Create full page layouts with proper structure
- Use semantic HTML elements
- Implement responsive design principles
- Include proper SEO meta tags
- Use modern CSS Grid and Flexbox layouts
- Ensure accessibility compliance`,

      style: `You are a CSS expert specializing in Tailwind CSS. Generate clean, efficient styling solutions.

Rules:
- Use Tailwind utility classes
- Ensure responsive design
- Follow design system principles
- Optimize for performance
- Use modern CSS features appropriately`
    };

    return prompts[type] || prompts.component;
  }

  extractCode(content) {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```(?:jsx?|tsx?|html|css)?\n?([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    
    if (match) {
      return match[1].trim();
    }
    
    // If no code block found, return the content as is
    return content.trim();
  }

  async debugCode(code, error) {
    // Simple debugging rules
    const fixes = {
      'ReferenceError': () => {
        // Add missing imports
        if (!code.includes('import React')) {
          return `import React from 'react';\n${code}`;
        }
        return code;
      },
      'SyntaxError': () => {
        // Fix common syntax issues
        return code
          .replace(/className=/g, 'className=')
          .replace(/class=/g, 'className=')
          .replace(/;/g, '');
      }
    };

    const fix = fixes[error.name];
    return fix ? fix() : code;
  }

  // Get user's code generation history
  async getUserCodeHistory(userId, limit = 20) {
    try {
      // Mock response for now
      return { 
        success: true, 
        templates: [] 
      };
    } catch (error) {
      console.error('History fetch error:', error);
      return { 
        success: false, 
        error: 'Failed to fetch history' 
      };
    }
  }

  // Search database for existing code templates
  async searchDatabaseTemplates(prompt, options = {}) {
    try {
      // Mock response for now
      return { 
        found: false 
      };
    } catch (error) {
      console.error('Database search error:', error);
      return { 
        found: false 
      };
    }
  }
}

module.exports = new EnhancedAiService();
