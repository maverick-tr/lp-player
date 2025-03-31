import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec } from 'child_process';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os'; // Add os module for system monitoring

// Get current file directory (ESM replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Parse command line arguments for port
const args = process.argv.slice(2);
let PORT = process.env.PORT || 4242;
let HOST = process.env.HOST || 'localhost';

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    PORT = parseInt(args[i + 1], 10);
    console.log(`Using port from command line argument: ${PORT}`);
    i++; // Skip the next argument which is the port number
  } else if (args[i] === '--host' && i + 1 < args.length) {
    HOST = args[i + 1];
    console.log(`Using host from command line argument: ${HOST}`);
    i++; // Skip the next argument which is the host
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  // Add WebSocket CORS settings
  verifyClient: (info, callback) => {
    // Accept all origins
    callback(true);
  }
});

// Process map for managing running processes
const runningProcesses = new Map();
// WebSocket clients map
const clients = new Map();

// System monitoring data
let lastCpuUsage = null;
let lastCpuTimes = null;
const systemMonitoringClients = new Set();

// Middleware
app.use(cors({
  origin: '*', // Allow any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  clients.set(clientId, ws);
  
  console.log(`WebSocket client connected: ${clientId} from ${req.socket.remoteAddress}`);
  
  // Set a property on the ws object to identify this client
  ws.clientId = clientId;
  ws.isAlive = true;
  
  // Set up ping-pong to keep connection alive
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (message) => {
    try {
      console.log(`Received message from client ${clientId}: ${message.toString()}`);
      const data = JSON.parse(message.toString());
      
      if (data.type === 'subscribe' && data.toolId) {
        // Associate this client with a specific tool/process
        ws.toolId = data.toolId;
        console.log(`Client ${clientId} subscribed to tool ${data.toolId}`);
        
        // Confirm subscription
        ws.send(JSON.stringify({ 
          type: 'info', 
          message: `Subscribed to process output for tool ID: ${data.toolId}`
        }));
        
        // Check if a process is already running for this tool
        if (runningProcesses.has(data.toolId)) {
          ws.send(JSON.stringify({
            type: 'process-output',
            toolId: data.toolId,
            outputType: 'info',
            data: 'Connected to running process'
          }));
        }
      } else if (data.type === 'ping') {
        // Respond to client ping with pong
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (data.type === 'subscribe-system-stats') {
        // Subscribe client to system stats
        systemMonitoringClients.add(clientId);
        console.log(`Client ${clientId} subscribed to system stats`);
        
        // Send initial system stats
        const initialStats = getSystemStats();
        ws.send(JSON.stringify({
          type: 'system-stats',
          ...initialStats
        }));
      } else if (data.type === 'unsubscribe-system-stats') {
        // Unsubscribe client from system stats
        systemMonitoringClients.delete(clientId);
        console.log(`Client ${clientId} unsubscribed from system stats`);
      }
    } catch (e) {
      console.error(`Error processing WebSocket message from client ${clientId}:`, e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    systemMonitoringClients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({ type: 'connected' }));
});

// Set up interval to ping clients and clean up dead connections
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`Terminating inactive WebSocket client: ${ws.clientId}`);
      clients.delete(ws.clientId);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (error) {
      console.error(`Error pinging client ${ws.clientId}:`, error);
    }
  });
}, 30000); // Check every 30 seconds

// Clean up interval on server close
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Function to calculate CPU usage percentage
function calculateCpuUsage() {
  try {
    const cpus = os.cpus();
    
    if (!cpus || cpus.length === 0) {
      return { usage: 0, error: 'No CPU information available' };
    }
    
    // Initialize data structures for first run
    if (!lastCpuTimes) {
      lastCpuTimes = cpus.map(cpu => {
        const times = cpu.times;
        return {
          idle: times.idle,
          total: times.user + times.nice + times.sys + times.idle + times.irq
        };
      });
      return { usage: 0 };
    }
    
    // Calculate CPU usage across all cores
    let totalUsage = 0;
    
    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const times = cpu.times;
      
      const idle = times.idle;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      
      // Get last measurements
      const lastMeasurement = lastCpuTimes[i];
      
      // Calculate deltas
      const idleDelta = idle - lastMeasurement.idle;
      const totalDelta = total - lastMeasurement.total;
      
      // Update last measurements
      lastCpuTimes[i] = { idle, total };
      
      // Calculate core usage and add to total
      const coreUsage = 100 - (idleDelta / totalDelta * 100);
      totalUsage += coreUsage;
    }
    
    // Get average usage across all cores
    const averageUsage = totalUsage / cpus.length;
    
    // Ensure it's within valid range
    return { usage: Math.min(100, Math.max(0, Math.round(averageUsage))) };
  } catch (error) {
    console.error('Error calculating CPU usage:', error);
    return { usage: 0, error: error.message };
  }
}

// Function to get memory usage percentage
function getMemoryUsage() {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    return { usage: Math.round(memoryUsagePercent) };
  } catch (error) {
    console.error('Error calculating memory usage:', error);
    return { usage: 0, error: error.message };
  }
}

// Function to get combined system stats
function getSystemStats() {
  const cpuStats = calculateCpuUsage();
  const memoryStats = getMemoryUsage();
  
  return {
    cpu: cpuStats.usage,
    memory: memoryStats.usage,
    timestamp: Date.now()
  };
}

// Function to broadcast system stats to subscribed clients
function broadcastSystemStats(stats) {
  let clientCount = 0;
  
  for (const clientId of systemMonitoringClients) {
    const client = clients.get(clientId);
    
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          type: 'system-stats',
          ...stats
        }));
        clientCount++;
      } catch (error) {
        console.error(`Error sending system stats to client ${clientId}:`, error);
        systemMonitoringClients.delete(clientId);
      }
    } else {
      // Clean up if client is no longer connected
      systemMonitoringClients.delete(clientId);
    }
  }
  
  if (clientCount > 0) {
    console.log(`Broadcast system stats to ${clientCount} clients. CPU: ${stats.cpu}%, Memory: ${stats.memory}%`);
  }
}

// Set up interval to collect and broadcast system stats
const systemStatsInterval = setInterval(() => {
  if (systemMonitoringClients.size > 0) {
    const stats = getSystemStats();
    broadcastSystemStats(stats);
  }
}, 2000); // Update every 2 seconds, matching the frontend update interval

// Clean up interval on server close
server.on('close', () => {
  clearInterval(systemStatsInterval);
  clearInterval(pingInterval);
});

// Broadcast to clients subscribed to a specific tool
function broadcastProcessOutput(toolId, data, outputType = 'stdout') {
  console.log(`Attempting to broadcast to toolId: ${toolId}, data: ${data.toString().substring(0, 100)}...`);
  let clientCount = 0;
  
  // Iterate through the clients Map
  for (const [clientId, client] of clients.entries()) {
    console.log(`Checking client ${clientId}: toolId=${client.toolId}, readyState=${client.readyState}`);
    if (client.toolId === toolId && client.readyState === WebSocket.OPEN) {
      console.log(`Broadcasting to client ${clientId} with toolId: ${toolId}`);
      try {
        client.send(JSON.stringify({
          type: 'process-output',
          toolId,
          outputType,
          data: data.toString()
        }));
        clientCount++;
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
      }
    }
  }
  
  console.log(`Broadcast complete. Sent to ${clientCount} clients.`);
}

// Constants
const TOOLS_FILE = path.join(__dirname, 'src/data/tools.json');

// Get all tools
app.get('/api/tools', async (req, res) => {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const tools = JSON.parse(data);
    res.json(tools);
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(500).json({ error: 'Failed to read tools' });
  }
});

// Update tools
app.post('/api/tools', async (req, res) => {
  try {
    const { tools } = req.body;
    
    if (!tools || !Array.isArray(tools)) {
      return res.status(400).json({ error: 'Invalid tools data' });
    }

    // Read the current data
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const currentData = JSON.parse(data);
    
    // Update tools
    const updatedData = { ...currentData, tools };
    
    // Write updated data back to file
    await fs.writeFile(TOOLS_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    
    res.json({ success: true, message: 'Tools updated successfully' });
  } catch (error) {
    console.error('Error updating tools:', error);
    res.status(500).json({ error: 'Failed to update tools' });
  }
});

// API endpoint to run a tool
app.post('/api/tools/run', async (req, res) => {
  try {
    const { toolId, rootPath, command, envCommand } = req.body;
    
    if (!toolId || !rootPath || !command) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    
    // Construct the full command
    let fullCommand;
    if (command.endsWith('.sh') || command.startsWith('./')) {
      // For shell scripts, make sure they are executable and use bash to run them
      fullCommand = envCommand 
        ? `cd "${rootPath}" && ${envCommand} && bash ${command}`
        : `cd "${rootPath}" && bash ${command}`;
    } else {
      fullCommand = envCommand 
        ? `cd "${rootPath}" && ${envCommand} && ${command}`
        : `cd "${rootPath}" && ${command}`;
    }
    
    console.log(`Executing command for tool ${toolId}: ${fullCommand}`);
    
    try {
      // Check if a process is already running for this tool
      if (runningProcesses.has(toolId)) {
        console.log(`Process for tool ${toolId} is already running`);
        return res.status(409).json({ 
          success: false, 
          message: 'A process is already running for this tool' 
        });
      }
      
      // Execute the command with shell option to ensure commands like source work
      const process = exec(fullCommand, { 
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer to handle large outputs
        shell: '/bin/bash'
      });
      
      // Store the process
      runningProcesses.set(toolId, process);
      
      // Broadcast initial command execution
      broadcastProcessOutput(toolId, `$ ${fullCommand}`, 'command');
      
      // Handle stdout
      process.stdout.on('data', (data) => {
        console.log(`[Tool ${toolId}] stdout: ${data.toString().trim()}`);
        broadcastProcessOutput(toolId, data, 'stdout');
      });
      
      // Handle stderr
      process.stderr.on('data', (data) => {
        console.error(`[Tool ${toolId}] stderr: ${data.toString().trim()}`);
        broadcastProcessOutput(toolId, data, 'stderr');
      });
      
      // Handle process exit
      process.on('exit', (code) => {
        console.log(`[Tool ${toolId}] Process exited with code ${code}`);
        broadcastProcessOutput(toolId, `Process exited with code ${code}`, 'exit');
        runningProcesses.delete(toolId);
      });
      
      // Handle process error
      process.on('error', (error) => {
        console.error(`[Tool ${toolId}] Process error: ${error.message}`);
        broadcastProcessOutput(toolId, `Process error: ${error.message}`, 'error');
        runningProcesses.delete(toolId);
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ success: true });
    } catch (execError) {
      console.error(`Error executing command: ${execError.message}`);
      res.status(500).json({ 
        success: false, 
        message: `Error executing command: ${execError.message}` 
      });
    }
  } catch (error) {
    console.error('Error running tool:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to stop a tool
app.post('/api/tools/stop', async (req, res) => {
  try {
    const { toolId } = req.body;
    
    if (!toolId) {
      return res.status(400).json({ success: false, message: 'Tool ID is required' });
    }
    
    const process = runningProcesses.get(toolId);
    if (!process) {
      return res.status(404).json({ success: false, message: 'No running process found for this tool' });
    }
    
    try {
      console.log(`Stopping process for tool ${toolId}`);
      
      // Broadcast we're stopping the process
      broadcastProcessOutput(toolId, 'Stopping process...', 'info');
      
      // Kill process and all child processes
      if (process.pid) {
        console.log(`Killing process with PID ${process.pid}`);
        
        // On Unix/Linux/Mac, try to kill the process group
        if (process.platform !== 'win32') {
          try {
            // Try to kill the entire process group first (sends SIGTERM to all processes in the group)
            exec(`pkill -TERM -P ${process.pid}`, (error) => {
              if (error) {
                console.log(`pkill error: ${error.message}, falling back to kill directly`);
              }
              
              // Then kill the main process
              process.kill('SIGTERM');
            });
          } catch (killError) {
            console.log(`Advanced kill failed: ${killError.message}, falling back to basic kill`);
            process.kill(); // Basic kill as fallback
          }
        } else {
          // On Windows, we need a different approach
          try {
            exec(`taskkill /pid ${process.pid} /T /F`, (error) => {
              if (error) {
                console.log(`taskkill error: ${error.message}, falling back to kill directly`);
                process.kill();
              }
            });
          } catch (winKillError) {
            console.log(`Windows kill failed: ${winKillError.message}, falling back to basic kill`);
            process.kill();
          }
        }
      } else {
        // No PID available, use the standard kill method
        process.kill();
      }
      
      runningProcesses.delete(toolId);
      
      // Broadcast process terminated message
      broadcastProcessOutput(toolId, 'Process terminated by user', 'exit');
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ success: true });
    } catch (killError) {
      console.error(`Error killing process: ${killError.message}`);
      
      // Even if there's an error, try to update status and remove from running processes
      runningProcesses.delete(toolId);
      broadcastProcessOutput(toolId, `Error stopping process: ${killError.message}`, 'error');
      
      res.status(500).json({ 
        success: false, 
        message: `Error killing process: ${killError.message}` 
      });
    }
  } catch (error) {
    console.error('Error stopping tool:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to detect environment in a directory
app.post('/api/detect-environment', async (req, res) => {
  try {
    const { rootPath } = req.body;
    
    if (!rootPath) {
      return res.status(400).json({ success: false, message: 'Root path is required' });
    }
    
    console.log(`Detecting environment in: ${rootPath}`);
    
    // Check for various environment indicators
    const environmentInfo = {
      hasPythonVenv: false,
      hasConda: false,
      hasNodeModules: false,
      hasDotEnv: false,
      hasDocker: false
    };
    
    try {
      // Check for Python virtual environment
      try {
        const venvPaths = [
          path.join(rootPath, '.venv'),
          path.join(rootPath, 'venv'),
          path.join(rootPath, 'env')
        ];
        
        for (const venvPath of venvPaths) {
          const activateScript = path.join(venvPath, 'bin', 'activate');
          await fs.access(activateScript);
          environmentInfo.hasPythonVenv = true;
          break;
        }
      } catch (e) {
        // Ignore errors if not found
      }
      
      // Check for Conda environment
      try {
        const condaPaths = [
          path.join(rootPath, 'conda-meta'),
          path.join(rootPath, 'miniconda3'),
          path.join(rootPath, 'anaconda3')
        ];
        
        for (const condaPath of condaPaths) {
          await fs.access(condaPath);
          environmentInfo.hasConda = true;
          break;
        }
      } catch (e) {
        // Ignore errors if not found
      }
      
      // Check for Node.js project
      try {
        await fs.access(path.join(rootPath, 'node_modules'));
        environmentInfo.hasNodeModules = true;
      } catch (e) {
        // Ignore errors if not found
      }
      
      // Check for .env file
      try {
        await fs.access(path.join(rootPath, '.env'));
        environmentInfo.hasDotEnv = true;
      } catch (e) {
        // Ignore errors if not found
      }
      
      // Check for Docker
      try {
        await fs.access(path.join(rootPath, 'Dockerfile'));
        environmentInfo.hasDocker = true;
      } catch (e) {
        // Ignore errors if not found
      }
      
    } catch (error) {
      console.error(`Error checking environment: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        message: `Error checking environment: ${error.message}` 
      });
    }
    
    console.log(`Environment detection results for ${rootPath}:`, environmentInfo);
    res.status(200).json(environmentInfo);
  } catch (error) {
    console.error('Error detecting environment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint for system stats
app.get('/api/system-stats', (req, res) => {
  try {
    const stats = getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/tools/run - Run a tool');
  console.log('  POST /api/tools/stop - Stop a tool');
  console.log('  GET /api/system-stats - Get system stats');
  console.log(`  WebSocket server - ws://${HOST}:${PORT}`);
}); 