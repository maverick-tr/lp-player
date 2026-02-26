import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec, execFile } from 'child_process';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import { readSettings, writeSettings, redactForFrontend } from './server/services/settingsService.js';
import { startInstallation, getInstallation, resolveQuestion, cancelInstallation, getInstallLog } from './server/services/installService.js';
import { TOOLS_FILE } from './server/services/dataDir.js';

// Get current file directory (ESM replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Parse command line arguments for port
const args = process.argv.slice(2);
let PORT = process.env.PORT || 4243;
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
        systemMonitoringClients.delete(clientId);
        console.log(`Client ${clientId} unsubscribed from system stats`);
      } else if (data.type === 'subscribe-install' && data.installId) {
        ws.installId = data.installId;
        console.log(`Client ${clientId} subscribed to install: ${data.installId}`);
      } else if (data.type === 'install-answer' && data.installId && data.questionId) {
        resolveQuestion(data.installId, data.questionId, data.answer);
        console.log(`Install answer received for ${data.installId}: ${data.answer}`);
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

// TOOLS_FILE imported from server/services/dataDir.js

// Write lock to prevent concurrent writes corrupting tools.json
let toolsWriteLock = Promise.resolve();
async function safeWriteTools(data) {
  toolsWriteLock = toolsWriteLock.then(async () => {
    await fs.writeFile(TOOLS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }).catch(err => {
    console.error('Error in safeWriteTools:', err);
  });
  return toolsWriteLock;
}

// ── Settings API ──────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  try {
    const settings = readSettings();
    res.json(redactForFrontend(settings));
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = writeSettings(req.body);
    res.json(redactForFrontend(updated));
  } catch (error) {
    console.error('Error writing settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Test AI connection
app.post('/api/settings/test-ai', async (req, res) => {
  try {
    const settings = readSettings();
    if (!settings.ai.apiKey) {
      return res.status(400).json({ error: 'No API key configured' });
    }
    const response = await fetch(`${settings.ai.apiUrl}/models`, {
      headers: { 'Authorization': `Bearer ${settings.ai.apiKey}` }
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `API error: ${text}` });
    }
    const data = await response.json();
    res.json({ success: true, models: (data.data || []).slice(0, 10).map(m => m.id) });
  } catch (error) {
    res.status(500).json({ error: `Connection failed: ${error.message}` });
  }
});

// ── Install API ───────────────────────────────────────────────

// Broadcast install progress to subscribed WebSocket clients
function broadcastInstallProgress(installId, progressData) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.installId === installId) {
      client.send(JSON.stringify({
        type: 'install-progress',
        installId,
        ...progressData
      }));
    }
  });
}

app.post('/api/install/start', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    let { targetPath } = req.body;
    if (!repoUrl || !targetPath || !targetPath.trim()) {
      return res.status(400).json({ error: 'repoUrl and targetPath are required' });
    }

    // Expand ~ to home directory and resolve to absolute path
    targetPath = targetPath.trim();
    if (targetPath.startsWith('~/') || targetPath === '~') {
      targetPath = path.join(os.homedir(), targetPath.slice(1));
    }
    targetPath = path.resolve(targetPath);
    console.log(`[install] Starting: repo=${repoUrl}, target=${targetPath}`);

    // Load existing tools for port conflict detection
    let existingTools = [];
    try {
      const data = await fs.readFile(TOOLS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      existingTools = parsed.tools || [];
    } catch { /* ignore */ }

    const installId = await startInstallation(repoUrl, targetPath, existingTools, broadcastInstallProgress);
    res.json({ installId });
  } catch (error) {
    console.error('Install start error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/install/cancel/:installId', (req, res) => {
  const ok = cancelInstallation(req.params.installId);
  res.json({ success: ok });
});

app.get('/api/install/status/:installId', (req, res) => {
  const state = getInstallation(req.params.installId);
  if (!state) return res.status(404).json({ error: 'Installation not found' });
  res.json({
    installId: state.installId,
    phase: state.phase,
    plan: state.plan,
    error: state.error,
    steps: state.steps
  });
});

app.get('/api/install/log/:installId', async (req, res) => {
  const log = await getInstallLog(req.params.installId);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  res.type('text/plain').send(log);
});

// ── Fetch Image / Favicon API ─────────────────────────────────
app.post('/api/fetch-image', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Validate URL
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' });
    }

    const isImageUrl = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|avif)(\?.*)?$/i.test(parsed.pathname);

    if (isImageUrl) {
      // Direct image URL — download it
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const ct = imgRes.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const dataUri = `data:${ct};base64,${buf.toString('base64')}`;
      return res.json({ success: true, dataUri });
    }

    // Website URL — try to find favicon
    const faviconUrls = [];

    // 1. Try parsing HTML for link[rel*="icon"]
    try {
      const htmlRes = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0 LAP-Favicon-Fetcher' }
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        // Match <link rel="icon" href="..."> and variants (shortcut icon, apple-touch-icon)
        const linkRegex = /<link[^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
        const hrefFirstRegex = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*>/gi;
        let m;
        while ((m = linkRegex.exec(html)) !== null) faviconUrls.push(m[1]);
        while ((m = hrefFirstRegex.exec(html)) !== null) faviconUrls.push(m[1]);
      }
    } catch { /* ignore HTML fetch errors */ }

    // 2. Common favicon paths as fallback
    faviconUrls.push('/favicon.ico', '/favicon.png', '/apple-touch-icon.png');

    // Try each favicon URL
    for (const fav of faviconUrls) {
      try {
        const favUrl = fav.startsWith('http') ? fav : new URL(fav, url).href;
        const favRes = await fetch(favUrl, { signal: AbortSignal.timeout(5000) });
        if (!favRes.ok) continue;
        const ct = favRes.headers.get('content-type') || '';
        if (!ct.includes('image') && !ct.includes('icon') && !ct.includes('svg')) continue;
        const buf = Buffer.from(await favRes.arrayBuffer());
        if (buf.length < 100) continue; // Too small, probably not a real image
        const dataUri = `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`;
        return res.json({ success: true, dataUri });
      } catch { /* try next */ }
    }

    // 3. Last resort: Google favicon service
    try {
      const googleUrl = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
      const gRes = await fetch(googleUrl, { signal: AbortSignal.timeout(5000) });
      if (gRes.ok) {
        const ct = gRes.headers.get('content-type') || 'image/png';
        const buf = Buffer.from(await gRes.arrayBuffer());
        if (buf.length > 100) {
          const dataUri = `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`;
          return res.json({ success: true, dataUri });
        }
      }
    } catch { /* ignore */ }

    res.json({ success: false, error: 'Could not find a favicon for this URL' });
  } catch (error) {
    console.error('Error fetching image:', error.message);
    res.status(500).json({ error: `Failed to fetch image: ${error.message}` });
  }
});

// ── Git Clone API (no AI required) ────────────────────────────

app.post('/api/git-clone', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    let { targetPath } = req.body;
    if (!repoUrl || !targetPath) {
      return res.status(400).json({ error: 'repoUrl and targetPath are required' });
    }

    targetPath = targetPath.trim();
    if (targetPath.startsWith('~/') || targetPath === '~') {
      targetPath = path.join(os.homedir(), targetPath.slice(1));
    }
    targetPath = path.resolve(targetPath);

    // Ensure target directory exists
    await fs.mkdir(targetPath, { recursive: true });

    const repoName = repoUrl.replace(/\.git$/, '').split('/').pop() || 'project';
    const clonedPath = path.join(targetPath, repoName);

    await new Promise((resolve, reject) => {
      exec(`git clone "${repoUrl}" "${clonedPath}"`, { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });

    res.json({ success: true, clonedPath, repoName });
  } catch (error) {
    console.error('Git clone error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Tools API ─────────────────────────────────────────────────

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
    await safeWriteTools(updatedData);
    
    res.json({ success: true, message: 'Tools updated successfully' });
  } catch (error) {
    console.error('Error updating tools:', error);
    res.status(500).json({ error: 'Failed to update tools' });
  }
});

// API endpoint to run a tool
app.post('/api/tools/run', async (req, res) => {
  try {
    const { toolId, rootPath, command, envCommand, envVariables } = req.body;

    if (!toolId || !rootPath || !command) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // Construct the full command
    let fullCommand;
    if (command.endsWith('.sh') || command.startsWith('./')) {
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
      if (runningProcesses.has(toolId)) {
        console.log(`Process for tool ${toolId} is already running`);
        return res.status(409).json({
          success: false,
          message: 'A process is already running for this tool'
        });
      }

      // Build environment: inherit system env + overlay custom vars
      const processEnv = { ...process.env };
      if (envVariables && typeof envVariables === 'object') {
        Object.assign(processEnv, envVariables);
      }

      const childProc = exec(fullCommand, {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
        shell: '/bin/bash',
        env: processEnv
      });

      runningProcesses.set(toolId, childProc);
      broadcastProcessOutput(toolId, `$ ${fullCommand}`, 'command');

      childProc.stdout.on('data', (data) => {
        console.log(`[Tool ${toolId}] stdout: ${data.toString().trim()}`);
        broadcastProcessOutput(toolId, data, 'stdout');
      });

      childProc.stderr.on('data', (data) => {
        console.error(`[Tool ${toolId}] stderr: ${data.toString().trim()}`);
        broadcastProcessOutput(toolId, data, 'stderr');
      });

      childProc.on('exit', (code) => {
        console.log(`[Tool ${toolId}] Process exited with code ${code}`);
        broadcastProcessOutput(toolId, `Process exited with code ${code}`, 'exit');
        runningProcesses.delete(toolId);
      });

      childProc.on('error', (error) => {
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
      venvDir: null,       // which venv dir was found (.venv, venv, env)
      hasConda: false,
      condaDir: null,
      hasNodeModules: false,
      hasDotEnv: false,
      hasDocker: false,
      platform: process.platform  // win32, darwin, linux
    };

    try {
      // Check for Python virtual environment (per-path try/catch so all are tested)
      const venvNames = ['.venv', 'venv', 'env'];
      for (const name of venvNames) {
        try {
          // Check both Unix and Windows activate paths
          const unixActivate = path.join(rootPath, name, 'bin', 'activate');
          const winActivate = path.join(rootPath, name, 'Scripts', 'activate.bat');
          try {
            await fs.access(unixActivate);
            environmentInfo.hasPythonVenv = true;
            environmentInfo.venvDir = name;
            break;
          } catch {
            await fs.access(winActivate);
            environmentInfo.hasPythonVenv = true;
            environmentInfo.venvDir = name;
            break;
          }
        } catch {
          // This venv path doesn't exist, try next
        }
      }

      // Check for Conda environment
      const condaNames = ['conda-meta', 'miniconda3', 'anaconda3'];
      for (const name of condaNames) {
        try {
          await fs.access(path.join(rootPath, name));
          environmentInfo.hasConda = true;
          environmentInfo.condaDir = name;
          break;
        } catch {
          // This conda path doesn't exist, try next
        }
      }

      // Check for Node.js project
      try {
        await fs.access(path.join(rootPath, 'node_modules'));
        environmentInfo.hasNodeModules = true;
      } catch {
        // not found
      }

      // Check for .env file
      try {
        await fs.access(path.join(rootPath, '.env'));
        environmentInfo.hasDotEnv = true;
      } catch {
        // not found
      }

      // Check for Docker
      try {
        await fs.access(path.join(rootPath, 'Dockerfile'));
        environmentInfo.hasDocker = true;
      } catch {
        // not found
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

// ── Directory Listing API ──────────────────────────────────────
app.post('/api/list-directories', async (req, res) => {
  try {
    let { basePath } = req.body;
    if (!basePath) {
      return res.status(400).json({ error: 'basePath is required' });
    }

    basePath = basePath.trim();
    if (basePath.startsWith('~/') || basePath === '~') {
      basePath = path.join(os.homedir(), basePath.slice(1));
    }
    basePath = path.resolve(basePath);

    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const directories = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();

    res.json({ directories });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.json({ directories: [] });
    }
    console.error('Error listing directories:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── UV Detection API ──────────────────────────────────────────
app.get('/api/check-uv', (req, res) => {
  // Use login shell to get full PATH (GUI apps / pkg binaries may have stripped PATH)
  const shell = process.platform === 'win32' ? 'cmd' : '/bin/bash';
  const shellArgs = process.platform === 'win32'
    ? ['/c', 'uv --version']
    : ['-lc', 'uv --version'];
  execFile(shell, shellArgs, { timeout: 5000 }, (err, stdout) => {
    if (err) {
      return res.json({ installed: false, version: null });
    }
    const version = stdout.trim().replace(/^uv\s+/, '');
    res.json({ installed: true, version });
  });
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