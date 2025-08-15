// src/services/aiKnowledgeBase.js
const Project = require('../models/Project');
const mongoose = require('mongoose');

// Knowledge Base Schema for storing code with embeddings
const knowledgeEntrySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  userId: String,
  codeType: String, // 'component', 'service', 'route', 'full-project'
  description: String,
  code: String,
  metadata: {
    stack: String,
    category: String,
    features: [String],
    dependencies: [String]
  },
  embedding: [Number], // Vector embedding for similarity search
  reusageCount: { type: Number, default: 0 },
  successRate: { type: Number, default: 1.0 },
  createdAt: { type: Date, default: Date.now }
});

const KnowledgeEntry = mongoose.model('KnowledgeEntry', knowledgeEntrySchema);

class AIKnowledgeBase {
  constructor() {
    this.embeddingCache = new Map();
  }

  // Generate simple text embedding (in production, use OpenAI embeddings or similar)
  async generateEmbedding(text) {
    // Simple word frequency based embedding for demo
    // In production, use OpenAI embeddings API
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const wordCount = {};
    
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Create a simple vector representation
    const vocabulary = ['react', 'component', 'function', 'api', 'service', 'route', 'express', 'database', 'frontend', 'backend', 'auth', 'user', 'data', 'fetch', 'state', 'props', 'hook', 'context', 'store', 'form', 'validation', 'error', 'loading', 'success'];
    const embedding = vocabulary.map(word => wordCount[word] || 0);
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  // Calculate cosine similarity between embeddings
  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }

  // Store generated code in knowledge base
  async storeCode(projectId, userId, codeData) {
    try {
      const { code, description, codeType, metadata = {} } = codeData;
      
      // Generate embedding for the code
      const searchText = `${description} ${code}`;
      const embedding = await this.generateEmbedding(searchText);
      
      const knowledgeEntry = new KnowledgeEntry({
        projectId,
        userId,
        codeType,
        description,
        code,
        metadata,
        embedding
      });
      
      await knowledgeEntry.save();
      console.log(`Stored code knowledge: ${codeType} - ${description}`);
      
      return knowledgeEntry;
    } catch (error) {
      console.error('Error storing code knowledge:', error);
      throw error;
    }
  }

  // Search for similar code in knowledge base
  async searchSimilarCode(query, filters = {}) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build search criteria
      const searchCriteria = {};
      if (filters.userId) searchCriteria.userId = filters.userId;
      if (filters.codeType) searchCriteria.codeType = filters.codeType;
      if (filters.stack) searchCriteria['metadata.stack'] = filters.stack;
      if (filters.category) searchCriteria['metadata.category'] = filters.category;
      
      const entries = await KnowledgeEntry.find(searchCriteria)
        .populate('projectId', 'name category')
        .limit(50);
      
      // Calculate similarities and sort
      const results = entries.map(entry => ({
        ...entry.toObject(),
        similarity: this.calculateSimilarity(queryEmbedding, entry.embedding)
      }))
      .filter(entry => entry.similarity > 0.1) // Minimum threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Top 10 results
      
      console.log(`Found ${results.length} similar code entries for query: ${query}`);
      return results;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  // Get best practices for a specific type of code
  async getBestPractices(codeType, stack) {
    try {
      const highSuccessEntries = await KnowledgeEntry.find({
        codeType,
        'metadata.stack': stack,
        successRate: { $gte: 0.8 },
        reusageCount: { $gte: 2 }
      })
      .sort({ successRate: -1, reusageCount: -1 })
      .limit(5);
      
      return highSuccessEntries.map(entry => ({
        description: entry.description,
        code: entry.code,
        metadata: entry.metadata,
        successRate: entry.successRate,
        reusageCount: entry.reusageCount
      }));
    } catch (error) {
      console.error('Error getting best practices:', error);
      return [];
    }
  }

  // Update code success metrics
  async updateCodeMetrics(entryId, wasSuccessful) {
    try {
      const entry = await KnowledgeEntry.findById(entryId);
      if (entry) {
        entry.reusageCount += 1;
        
        // Update success rate using running average
        const currentTotal = entry.successRate * (entry.reusageCount - 1);
        const newTotal = currentTotal + (wasSuccessful ? 1 : 0);
        entry.successRate = newTotal / entry.reusageCount;
        
        await entry.save();
      }
    } catch (error) {
      console.error('Error updating code metrics:', error);
    }
  }

  // Get knowledge base statistics
  async getKnowledgeStats(userId) {
    try {
      const stats = await KnowledgeEntry.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$codeType',
            count: { $sum: 1 },
            avgSuccessRate: { $avg: '$successRate' },
            totalReusage: { $sum: '$reusageCount' }
          }
        }
      ]);
      
      const totalEntries = await KnowledgeEntry.countDocuments({ userId });
      
      return {
        totalEntries,
        byType: stats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting knowledge stats:', error);
      return { totalEntries: 0, byType: [], lastUpdated: new Date() };
    }
  }
}

module.exports = new AIKnowledgeBase();
