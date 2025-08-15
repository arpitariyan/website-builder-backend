// src/services/socketService.js
const socketIo = require('socket.io');
const terminalService = require('./terminalService');
const aiOrchestrator = require('./aiOrchestrator');

class SocketService {
  constructor() {
    this.io = null;
    this.connections = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    // Set socket emitter for terminal service
    terminalService.setSocketEmitter(this);

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Store connection info
      this.connections.set(socket.id, {
        userId: null,
        projectId: null,
        connectedAt: new Date()
      });

      // Authentication
      socket.on('authenticate', (data) => {
        const connection = this.connections.get(socket.id);
        if (connection) {
          connection.userId = data.userId;
          connection.projectId = data.projectId;
          
          // Join project room
          if (data.projectId) {
            socket.join(`project:${data.projectId}`);
          }
          
          console.log(`User ${data.userId} authenticated for project ${data.projectId}`);
        }
      });

      // Terminal events
      socket.on('terminal:create', async (data) => {
        try {
          const connection = this.connections.get(socket.id);
          if (!connection?.userId || !connection?.projectId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const terminal = terminalService.createTerminal(
            connection.projectId, 
            connection.userId, 
            data.initialPath
          );
          
          socket.emit('terminal:created', terminal);
          socket.join(`terminal:${terminal.terminalId}`);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('terminal:execute', (data) => {
        try {
          terminalService.executeCommand(data.terminalId, data.command);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('terminal:kill', (data) => {
        try {
          terminalService.killTerminal(data.terminalId);
          socket.leave(`terminal:${data.terminalId}`);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Live code generation events
      socket.on('code:generate', async (data) => {
        try {
          const connection = this.connections.get(socket.id);
          if (!connection?.userId || !connection?.projectId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          // Emit generation started
          socket.emit('code:generation:started', { 
            timestamp: new Date(),
            request: data 
          });

          // Start the AI generation process
          this.generateCodeLive(socket, connection.userId, connection.projectId, data);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // File system events
      socket.on('file:save', async (data) => {
        try {
          const connection = this.connections.get(socket.id);
          if (!connection?.projectId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          await terminalService.writeWorkspaceFile(
            connection.projectId, 
            data.filePath, 
            data.content
          );
          
          // Notify other clients in the project room
          socket.to(`project:${connection.projectId}`).emit('file:updated', {
            filePath: data.filePath,
            timestamp: new Date()
          });
          
          socket.emit('file:saved', { filePath: data.filePath });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('file:delete', async (data) => {
        try {
          const connection = this.connections.get(socket.id);
          if (!connection?.projectId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          await terminalService.deleteWorkspaceFile(connection.projectId, data.filePath);
          
          // Notify other clients
          socket.to(`project:${connection.projectId}`).emit('file:deleted', {
            filePath: data.filePath,
            timestamp: new Date()
          });
          
          socket.emit('file:deleted:success', { filePath: data.filePath });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.connections.delete(socket.id);
      });
    });

    console.log('Socket.IO service initialized');
  }

  // Live code generation with real-time streaming
  async generateCodeLive(socket, userId, projectId, request) {
    try {
      // Import project data
      const Project = require('../models/Project');
      const project = await Project.findById(projectId);
      
      if (!project) {
        socket.emit('error', { message: 'Project not found' });
        return;
      }

      // Search knowledge base first
      socket.emit('code:generation:status', {
        stage: 'searching_knowledge',
        message: 'Searching knowledge base for similar code...'
      });

      const knowledgeResults = await aiOrchestrator.searchKnowledgeBase(userId, request, project);
      
      if (knowledgeResults.length > 0) {
        socket.emit('code:generation:knowledge', {
          matches: knowledgeResults.length,
          topMatch: knowledgeResults[0]
        });
      }

      // Generate or adapt code
      socket.emit('code:generation:status', {
        stage: 'generating',
        message: 'Generating code with AI...'
      });

      const result = await aiOrchestrator.generateCode(userId, project, request);

      // Stream the generated files one by one
      if (result.files) {
        const fileEntries = Object.entries(result.files);
        
        for (let i = 0; i < fileEntries.length; i++) {
          const [filePath, fileData] = fileEntries[i];
          
          // Simulate live typing effect
          await this.streamCodeToSocket(socket, filePath, fileData.content, fileData.language);
          
          // Small delay between files
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Initialize workspace
        await terminalService.initializeWorkspace(projectId, result.files);

        // Update project in database
        project.content = { ...project.content, ...result.files };
        project.lastAiGeneration = {
          timestamp: new Date(),
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          source: result.source
        };
        await project.save();
      }

      // Generation completed
      socket.emit('code:generation:completed', {
        files: result.files,
        metadata: {
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          source: result.source,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Live code generation error:', error);
      socket.emit('code:generation:error', {
        message: error.message,
        timestamp: new Date()
      });
    }
  }

  // Stream code content with typing effect
  async streamCodeToSocket(socket, filePath, content, language) {
    const chunks = this.splitContentIntoChunks(content, 50); // 50 chars per chunk
    
    socket.emit('code:file:started', {
      filePath,
      language,
      totalChunks: chunks.length
    });

    for (let i = 0; i < chunks.length; i++) {
      socket.emit('code:file:chunk', {
        filePath,
        chunk: chunks[i],
        chunkIndex: i,
        isComplete: i === chunks.length - 1
      });
      
      // Typing delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    socket.emit('code:file:completed', {
      filePath,
      content,
      language
    });
  }

  // Split content into readable chunks
  splitContentIntoChunks(content, maxChunkSize) {
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  // Emit to terminal (called by terminalService)
  emit(eventName, data) {
    if (eventName.startsWith('terminal:')) {
      const terminalId = eventName.replace('terminal:', '');
      this.io.to(`terminal:${terminalId}`).emit('terminal:output', data);
    }
  }

  // Broadcast to project room
  broadcastToProject(projectId, eventName, data) {
    this.io.to(`project:${projectId}`).emit(eventName, data);
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.values())
    };
  }
}

module.exports = new SocketService();
