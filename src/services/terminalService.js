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

  // Get or create project workspace directory
  getProjectWorkspace(projectId) {
    if (this.projectWorkspaces.has(projectId)) {
      return this.projectWorkspaces.get(projectId);
    }
    
    const workspaceDir = path.join(__dirname, '../../storage/workspaces', projectId);
    this.projectWorkspaces.set(projectId, workspaceDir);
    
    // Ensure directory exists
    fs.mkdir(workspaceDir, { recursive: true }).catch(console.error);
    
    return workspaceDir;
  }

  // Initialize project workspace with files
  async initializeWorkspace(projectId, files) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    
    try {
      // Ensure workspace directory exists
      await fs.mkdir(workspaceDir, { recursive: true });
      
      // Write all project files to workspace
      for (const [filePath, fileData] of Object.entries(files)) {
        const fullPath = path.join(workspaceDir, filePath);
        const dirPath = path.dirname(fullPath);
        
        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true });
        
        // Write file content
        await fs.writeFile(fullPath, fileData.content || '');
      }
      
      console.log(`Workspace initialized for project ${projectId}`);
      return workspaceDir;
    } catch (error) {
      console.error('Error initializing workspace:', error);
      throw error;
    }
  }

  // Get workspace file tree
  async getWorkspaceTree(projectId) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    
    try {
      return await this.buildFileTree(workspaceDir);
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

  // Read file from workspace
  async readWorkspaceFile(projectId, filePath) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    const fullPath = path.join(workspaceDir, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return { content, path: filePath };
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  // Write file to workspace
  async writeWorkspaceFile(projectId, filePath, content) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    const fullPath = path.join(workspaceDir, filePath);
    const dirPath = path.dirname(fullPath);
    
    try {
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, content);
      
      return { success: true, path: filePath };
    } catch (error) {
      throw new Error(`Failed to write file: ${filePath}`);
    }
  }

  // Delete file from workspace
  async deleteWorkspaceFile(projectId, filePath) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    const fullPath = path.join(workspaceDir, filePath);
    
    try {
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await fs.rmdir(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      
      return { success: true, path: filePath };
    } catch (error) {
      throw new Error(`Failed to delete: ${filePath}`);
    }
  }

  // Create directory in workspace
  async createWorkspaceDirectory(projectId, dirPath) {
    const workspaceDir = this.getProjectWorkspace(projectId);
    const fullPath = path.join(workspaceDir, dirPath);
    
    try {
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true, path: dirPath };
    } catch (error) {
      throw new Error(`Failed to create directory: ${dirPath}`);
    }
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
