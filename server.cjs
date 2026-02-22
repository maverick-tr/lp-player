const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');

const app = express();

// Parse command line arguments for port
const args = process.argv.slice(2);
let PORT = process.env.PORT || 4243;
let HOST = process.env.HOST || '0.0.0.0';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    PORT = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--host' && i + 1 < args.length) {
    HOST = args[i + 1];
    i++;
  }
}

// Create HTTP server + WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  verifyClient: (info, callback) => { callback(true); }
});

// Process map for managing running processes
const runningProcesses = new Map();
// WebSocket clients map
const clients = new Map();

// System monitoring
let lastCpuTimes = null;
const systemMonitoringClients = new Set();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Constants
const TOOLS_FILE = path.join(__dirname, 'src/data/tools.json');

// Ensure proper MIME types for static files
const serveStatic = express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
});

app.use(serveStatic);

// ── Dynamic ESM service imports ──────────────────────────────
// Services are ES modules, load them lazily via dynamic import()
let _settingsService = null;
let _installService = null;

async function getSettingsService() {
  if (!_settingsService) {
    _settingsService = await import('./server/services/settingsService.js');
  }
  return _settingsService;
}

async function getInstallService() {
  if (!_installService) {
    _installService = await import('./server/services/installService.js');
  }
  return _installService;
}

// ── WebSocket ────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  clients.set(clientId, ws);
  ws.clientId = clientId;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'subscribe' && data.toolId) {
        ws.toolId = data.toolId;
        ws.send(JSON.stringify({ type: 'info', message: `Subscribed to tool ${data.toolId}` }));
        if (runningProcesses.has(data.toolId)) {
          ws.send(JSON.stringify({ type: 'process-output', toolId: data.toolId, outputType: 'info', data: 'Connected to running process' }));
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (data.type === 'subscribe-system-stats') {
        systemMonitoringClients.add(clientId);
        ws.send(JSON.stringify({ type: 'system-stats', ...getSystemStats() }));
      } else if (data.type === 'unsubscribe-system-stats') {
        systemMonitoringClients.delete(clientId);
      } else if (data.type === 'subscribe-install' && data.installId) {
        ws.installId = data.installId;
      } else if (data.type === 'install-answer' && data.installId && data.questionId) {
        try {
          const { resolveQuestion } = await getInstallService();
          resolveQuestion(data.installId, data.questionId, data.answer);
        } catch { /* ignore if service not loaded */ }
      }
    } catch (e) {
      console.error(`Error processing WebSocket message from ${clientId}:`, e);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    systemMonitoringClients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });

  ws.send(JSON.stringify({ type: 'connected' }));
});

// Ping interval
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients.delete(ws.clientId);
      return ws.terminate();
    }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  });
}, 30000);

wss.on('close', () => { clearInterval(pingInterval); });

// ── System Stats ─────────────────────────────────────────────

function calculateCpuUsage() {
  try {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) return { usage: 0 };
    if (!lastCpuTimes) {
      lastCpuTimes = cpus.map(cpu => ({
        idle: cpu.times.idle,
        total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
      }));
      return { usage: 0 };
    }
    let totalUsage = 0;
    for (let i = 0; i < cpus.length; i++) {
      const times = cpus[i].times;
      const idle = times.idle;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      const idleDelta = idle - lastCpuTimes[i].idle;
      const totalDelta = total - lastCpuTimes[i].total;
      lastCpuTimes[i] = { idle, total };
      totalUsage += 100 - (idleDelta / totalDelta * 100);
    }
    return { usage: Math.min(100, Math.max(0, Math.round(totalUsage / cpus.length))) };
  } catch { return { usage: 0 }; }
}

function getMemoryUsage() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    return { usage: Math.round(((total - free) / total) * 100) };
  } catch { return { usage: 0 }; }
}

function getSystemStats() {
  return { cpu: calculateCpuUsage().usage, memory: getMemoryUsage().usage, timestamp: Date.now() };
}

function broadcastSystemStats(stats) {
  for (const clientId of systemMonitoringClients) {
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try { client.send(JSON.stringify({ type: 'system-stats', ...stats })); }
      catch { systemMonitoringClients.delete(clientId); }
    } else {
      systemMonitoringClients.delete(clientId);
    }
  }
}

const systemStatsInterval = setInterval(() => {
  if (systemMonitoringClients.size > 0) broadcastSystemStats(getSystemStats());
}, 2000);

server.on('close', () => {
  clearInterval(systemStatsInterval);
  clearInterval(pingInterval);
});

// Broadcast process output to subscribed WS clients
function broadcastProcessOutput(toolId, data, outputType = 'stdout') {
  for (const [, client] of clients.entries()) {
    if (client.toolId === toolId && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ type: 'process-output', toolId, outputType, data: data.toString() }));
      } catch { /* ignore */ }
    }
  }
}

// ── Settings API ─────────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  try {
    const { readSettings, redactForFrontend } = await getSettingsService();
    res.json(redactForFrontend(readSettings()));
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { writeSettings, redactForFrontend } = await getSettingsService();
    const updated = writeSettings(req.body);
    res.json(redactForFrontend(updated));
  } catch (error) {
    console.error('Error writing settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.post('/api/settings/test-ai', async (req, res) => {
  try {
    const { readSettings } = await getSettingsService();
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

// ── Install API ──────────────────────────────────────────────

function broadcastInstallProgress(installId, progressData) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.installId === installId) {
      client.send(JSON.stringify({ type: 'install-progress', installId, ...progressData }));
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

    let existingTools = [];
    try {
      const data = await fs.readFile(TOOLS_FILE, 'utf8');
      existingTools = JSON.parse(data).tools || [];
    } catch { /* ignore */ }

    const { startInstallation } = await getInstallService();
    const installId = await startInstallation(repoUrl, targetPath, existingTools, broadcastInstallProgress);
    res.json({ installId });
  } catch (error) {
    console.error('Install start error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/install/cancel/:installId', async (req, res) => {
  try {
    const { cancelInstallation } = await getInstallService();
    const ok = cancelInstallation(req.params.installId);
    res.json({ success: ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/install/status/:installId', async (req, res) => {
  try {
    const { getInstallation } = await getInstallService();
    const state = getInstallation(req.params.installId);
    if (!state) return res.status(404).json({ error: 'Installation not found' });
    res.json({
      installId: state.installId,
      phase: state.phase,
      plan: state.plan,
      error: state.error,
      steps: state.steps
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/install/log/:installId', async (req, res) => {
  try {
    const { getInstallLog } = await getInstallService();
    const log = await getInstallLog(req.params.installId);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.type('text/plain').send(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Fetch Image / Favicon API ─────────────────────────────────
app.post('/api/fetch-image', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' });
    }

    const isImageUrl = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|avif)(\?.*)?$/i.test(parsed.pathname);

    if (isImageUrl) {
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const ct = imgRes.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const dataUri = `data:${ct};base64,${buf.toString('base64')}`;
      return res.json({ success: true, dataUri });
    }

    const faviconUrls = [];
    try {
      const htmlRes = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0 LAP-Favicon-Fetcher' }
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const linkRegex = /<link[^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
        const hrefFirstRegex = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*>/gi;
        let m;
        while ((m = linkRegex.exec(html)) !== null) faviconUrls.push(m[1]);
        while ((m = hrefFirstRegex.exec(html)) !== null) faviconUrls.push(m[1]);
      }
    } catch { /* ignore */ }

    faviconUrls.push('/favicon.ico', '/favicon.png', '/apple-touch-icon.png');

    for (const fav of faviconUrls) {
      try {
        const favUrl = fav.startsWith('http') ? fav : new URL(fav, url).href;
        const favRes = await fetch(favUrl, { signal: AbortSignal.timeout(5000) });
        if (!favRes.ok) continue;
        const ct = favRes.headers.get('content-type') || '';
        if (!ct.includes('image') && !ct.includes('icon') && !ct.includes('svg')) continue;
        const buf = Buffer.from(await favRes.arrayBuffer());
        if (buf.length < 100) continue;
        const dataUri = `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`;
        return res.json({ success: true, dataUri });
      } catch { /* try next */ }
    }

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

// ── Tools API ────────────────────────────────────────────────

app.get('/api/tools', async (req, res) => {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(500).json({ error: 'Failed to read tools' });
  }
});

app.post('/api/tools', async (req, res) => {
  try {
    const { tools } = req.body;
    if (!tools || !Array.isArray(tools)) {
      return res.status(400).json({ error: 'Invalid tools data' });
    }
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const currentData = JSON.parse(data);
    const updatedData = { ...currentData, tools };
    await fs.writeFile(TOOLS_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    res.json({ success: true, message: 'Tools updated successfully' });
  } catch (error) {
    console.error('Error updating tools:', error);
    res.status(500).json({ error: 'Failed to update tools' });
  }
});

app.post('/api/tools/run', async (req, res) => {
  try {
    const { toolId, rootPath, command, envCommand, envVariables } = req.body;
    if (!toolId || !rootPath || !command) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const fullCommand = envCommand
      ? `cd "${rootPath}" && ${envCommand} && ${command}`
      : `cd "${rootPath}" && ${command}`;

    // Build environment: inherit system env + overlay custom vars
    const processEnv = { ...process.env };
    if (envVariables && typeof envVariables === 'object') {
      Object.assign(processEnv, envVariables);
    }

    try {
      const proc = exec(fullCommand, { shell: '/bin/bash', windowsHide: true, env: processEnv });
      runningProcesses.set(toolId, proc);

      proc.stdout.on('data', (data) => {
        broadcastProcessOutput(toolId, data, 'stdout');
      });

      proc.stderr.on('data', (data) => {
        broadcastProcessOutput(toolId, data, 'stderr');
      });

      proc.on('exit', (code) => {
        runningProcesses.delete(toolId);
        broadcastProcessOutput(toolId, `Process exited with code ${code}`, 'exit');
        updateToolRunningStatus(toolId, false);
      });

      res.json({ success: true });
    } catch (execError) {
      res.status(500).json({ success: false, message: `Error executing command: ${execError.message}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tools/stop', async (req, res) => {
  try {
    const { toolId } = req.body;
    if (!toolId) {
      return res.status(400).json({ success: false, message: 'Tool ID is required' });
    }

    const proc = runningProcesses.get(toolId);
    if (!proc) {
      return res.status(404).json({ success: false, message: 'No running process found for this tool' });
    }

    try {
      proc.kill();
      runningProcesses.delete(toolId);
      await updateToolRunningStatus(toolId, false);
      res.json({ success: true });
    } catch (killError) {
      res.status(500).json({ success: false, message: `Error killing process: ${killError.message}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Detect Environment ───────────────────────────────────────

app.post('/api/detect-environment', async (req, res) => {
  try {
    const { rootPath } = req.body;
    if (!rootPath) {
      return res.status(400).json({ success: false, message: 'Root path is required' });
    }

    const info = {
      hasPythonVenv: false,
      hasConda: false,
      hasNodeModules: false,
      hasDotEnv: false,
      hasDocker: false
    };

    const checkAccess = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

    // Python venv
    for (const dir of ['.venv', 'venv', 'env']) {
      if (await checkAccess(path.join(rootPath, dir, 'bin', 'activate'))) {
        info.hasPythonVenv = true;
        break;
      }
    }

    // Conda
    for (const dir of ['conda-meta', 'miniconda3', 'anaconda3']) {
      if (await checkAccess(path.join(rootPath, dir))) {
        info.hasConda = true;
        break;
      }
    }

    info.hasNodeModules = await checkAccess(path.join(rootPath, 'node_modules'));
    info.hasDotEnv = await checkAccess(path.join(rootPath, '.env'));
    info.hasDocker = await checkAccess(path.join(rootPath, 'Dockerfile'));

    res.json(info);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── System Stats ─────────────────────────────────────────────

app.get('/api/system-stats', (req, res) => {
  try {
    res.json(getSystemStats());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// ── Helper ───────────────────────────────────────────────────

async function updateToolRunningStatus(toolId, isRunning) {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const tools = JSON.parse(data);
    const updatedTools = {
      ...tools,
      tools: tools.tools.map(tool =>
        tool.id === toolId
          ? { ...tool, execution: { ...tool.execution, isRunning } }
          : tool
      )
    };
    await fs.writeFile(TOOLS_FILE, JSON.stringify(updatedTools, null, 2), 'utf8');
  } catch (error) {
    console.error('Error updating tools file:', error);
  }
}

// For any other request, serve the index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Production server running at http://${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/tools - Get all tools');
  console.log('  POST /api/tools - Update tools');
  console.log('  POST /api/tools/run - Run a tool');
  console.log('  POST /api/tools/stop - Stop a tool');
  console.log('  GET  /api/settings - Get settings');
  console.log('  POST /api/settings - Update settings');
  console.log('  POST /api/install/start - Start installation');
  console.log('  POST /api/install/cancel/:id - Cancel installation');
  console.log('  WebSocket server - ws://localhost:' + PORT);
});
