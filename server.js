import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec } from 'child_process';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// Get current file directory (ESM replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3015;
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
      }
    } catch (e) {
      console.error(`Error processing WebSocket message from client ${clientId}:`, e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
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

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  POST /api/tools/run - Run a tool`);
  console.log(`  POST /api/tools/stop - Stop a tool`);
  console.log(`  WebSocket server - ws://0.0.0.0:${PORT}`);
}); 