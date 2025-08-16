// src/services/terminalService.js
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

class TerminalService {
  constructor() {
    this.terminals = new Map();
    this.projectWorkspaces = new Map();
  }

  // Create a new terminal session
  createTerminal(projectId, userId, initialPath = null) {
    const terminalId = uuidv4();
    const workspaceDir = this.getProjectWorkspace(projectId);
    
    // Determine shell based on platform
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = process.platform === 'win32' ? [] : ['-l'];
    
    // Create the terminal process
    const terminal = spawn(shell, shellArgs, {
      cwd: initialPath || workspaceDir,
      env: { ...process.env, TERM: 'xterm-256color' }
    });
    
    const terminalSession = {
      id: terminalId,
      process: terminal,
      projectId,
      userId,
      workingDirectory: initialPath || workspaceDir,
      output: [],
      isAlive: true,
      createdAt: new Date()
    };
    
    // Handle terminal output
    terminal.stdout.on('data', (data) => {
      const output = data.toString();
      terminalSession.output.push({
        type: 'stdout',
        content: output,
        timestamp: new Date()
      });
      
      // Emit to connected WebSocket clients
      this.emitToTerminal(terminalId, 'output', {
        type: 'stdout',
        content: output
      });
    });
    
    terminal.stderr.on('data', (data) => {
      const output = data.toString();
      terminalSession.output.push({
        type: 'stderr',
        content: output,
        timestamp: new Date()
      });
      
      this.emitToTerminal(terminalId, 'output', {
        type: 'stderr',
        content: output
      });
    });
    
    terminal.on('close', (code) => {
      terminalSession.isAlive = false;
      this.emitToTerminal(terminalId, 'close', { code });
    });
    
    this.terminals.set(terminalId, terminalSession);
    console.log(`Terminal ${terminalId} created for project ${projectId}`);
    
    return {
      terminalId,
      workingDirectory: terminalSession.workingDirectory
    };
  }

  // Execute command in terminal
  executeCommand(terminalId, command) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.isAlive) {
      throw new Error('Terminal not found or not active');
    }
    
    // Log the command
    terminal.output.push({
      type: 'command',
      content: command,
      timestamp: new Date()
    });
    
    this.emitToTerminal(terminalId, 'command', { content: command });
    
    // Send command to terminal
    terminal.process.stdin.write(command + '\n');
    
    return true;
  }

  // Get terminal output
  getTerminalOutput(terminalId, lines = 100) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error('Terminal not found');
    }
    
    return terminal.output.slice(-lines);
  }

  // Kill terminal
  killTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal && terminal.isAlive) {
      terminal.process.kill();
      terminal.isAlive = false;
      this.terminals.delete(terminalId);
      this.emitToTerminal(terminalId, 'killed', {});
    }
  }

  // Get or create project workspace directory (DISABLED - no physical folders)
  getProjectWorkspace(projectId) {
    // Return a virtual path - no actual folder creation
    return `/virtual/workspace/${projectId}`;
  }

  // Initialize project workspace with files (DISABLED - no physical files)
  async initializeWorkspace(projectId, files) {
    // No longer creates physical files - this is now handled in database only
    console.log(`Virtual workspace initialized for project ${projectId} (no physical files created)`);
    return `/virtual/workspace/${projectId}`;
  }

  // Get workspace file tree (from database, not physical files)
  async getWorkspaceTree(projectId) {
    try {
      // Return virtual file tree - no physical folder scanning
      return [
        {
          name: 'No physical files',
          type: 'message',
          path: 'virtual',
          message: 'Files are stored in database only'
        }
      ];
    } catch (error) {
      console.error('Error getting workspace tree:', error);
      return [];
    }
  }

  // Build file tree recursively
  async buildFileTree(dirPath, relativePath = '') {
    const items = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const itemPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            continue;
          }
          
          const children = await this.buildFileTree(fullPath, itemPath);
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'directory',
            children
          });
        } else {
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'file'
          });
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
    
    return items.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // Read file from workspace (DISABLED - no physical files)
  async readWorkspaceFile(projectId, filePath) {
    // No longer reads physical files - should read from database
    console.log(`Virtual file read: ${filePath} for project ${projectId}`);
    return { content: '', path: filePath };
  }

  // Write file to workspace (DISABLED - no physical files)
  async writeWorkspaceFile(projectId, filePath, content) {
    // No longer writes physical files - handled in database only
    console.log(`Virtual file write: ${filePath} for project ${projectId}`);
    return { success: true, path: filePath };
  }

  // Delete file from workspace (DISABLED - no physical files)
  async deleteWorkspaceFile(projectId, filePath) {
    // No longer deletes physical files - handled in database only
    console.log(`Virtual file delete: ${filePath} for project ${projectId}`);
    return { success: true, path: filePath };
  }

  // Create directory in workspace (DISABLED - no physical files)
  async createWorkspaceDirectory(projectId, dirPath) {
    // No longer creates physical directories - handled in database only
    console.log(`Virtual directory create: ${dirPath} for project ${projectId}`);
    return { success: true, path: dirPath };
  }

  // Install packages in workspace
  async installPackages(projectId, packages, isDevDependency = false) {
    const terminalId = this.createTerminal(projectId, 'system').terminalId;
    
    try {
      const command = `npm install ${isDevDependency ? '--save-dev' : ''} ${packages.join(' ')}`;
      this.executeCommand(terminalId, command);
      
      return { terminalId, command };
    } catch (error) {
      this.killTerminal(terminalId);
      throw error;
    }
  }

  // Run build command
  async runBuild(projectId) {
    const terminalId = this.createTerminal(projectId, 'system').terminalId;
    
    try {
      this.executeCommand(terminalId, 'npm run build');
      return { terminalId };
    } catch (error) {
      this.killTerminal(terminalId);
      throw error;
    }
  }

  // Run dev server
  async runDevServer(projectId) {
    const terminalId = this.createTerminal(projectId, 'system').terminalId;
    
    try {
      this.executeCommand(terminalId, 'npm run dev');
      return { terminalId };
    } catch (error) {
      this.killTerminal(terminalId);
      throw error;
    }
  }

  // Get active terminals for project
  getProjectTerminals(projectId) {
    const terminals = [];
    for (const [id, terminal] of this.terminals) {
      if (terminal.projectId === projectId && terminal.isAlive) {
        terminals.push({
          id,
          workingDirectory: terminal.workingDirectory,
          createdAt: terminal.createdAt
        });
      }
    }
    return terminals;
  }

  // WebSocket event emitter (to be connected with Socket.IO)
  emitToTerminal(terminalId, event, data) {
    // This will be connected to the WebSocket service
    if (this.socketEmitter) {
      this.socketEmitter.emit(`terminal:${terminalId}`, { event, data });
    }
  }

  // Set socket emitter for WebSocket integration
  setSocketEmitter(emitter) {
    this.socketEmitter = emitter;
  }

  // Cleanup inactive terminals
  cleanup() {
    for (const [id, terminal] of this.terminals) {
      if (!terminal.isAlive) {
        this.terminals.delete(id);
      }
    }
  }
}

module.exports = new TerminalService();
