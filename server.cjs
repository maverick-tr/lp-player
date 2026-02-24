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

// Data directory resolution (mirrors server/services/dataDir.js for CJS)
const resolveDataDir = () => {
  if (process.env.LP_PLAYER_DATA_DIR) return process.env.LP_PLAYER_DATA_DIR;
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'LP Player');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'LP Player');
  return path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'LP Player');
};

const DATA_DIR = resolveDataDir();
const fsSync = require('fs');
if (!fsSync.existsSync(DATA_DIR)) fsSync.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS_DIR = path.join(__dirname, 'src', 'data');

function ensureDataFile(filename, defaultContent) {
  const target = path.join(DATA_DIR, filename);
  if (!fsSync.existsSync(target)) {
    const source = path.join(DEFAULTS_DIR, filename);
    if (fsSync.existsSync(source)) {
      fsSync.copyFileSync(source, target);
      console.log(`[LP Player] Initialized ${filename} in ${DATA_DIR}`);
    } else {
      fsSync.writeFileSync(target, JSON.stringify(defaultContent, null, 2));
      console.log(`[LP Player] Created default ${filename} in ${DATA_DIR}`);
    }
  }
  return target;
}

const TOOLS_FILE = ensureDataFile('tools.json', { tools: [] });
const SETTINGS_FILE = ensureDataFile('settings.json', {
  ai: { apiUrl: '', apiKey: '', model: '' },
  installation: { autoConfirmPortChanges: false, autoRunWithoutReview: false, alwaysCreatePythonVenv: true, preferUv: true, autoSkipIncompatiblePackages: false },
  environment: { globalVariables: {} },
  soundEffects: { enabled: true, genre: '90s pop' }
});

// ── Inline Settings Service (CJS-compatible, no dynamic import) ──
const DEFAULT_SETTINGS = {
  ai: { apiUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o' },
  installation: { autoConfirmPortChanges: false, autoRunWithoutReview: false, alwaysCreatePythonVenv: true, preferUv: true, autoSkipIncompatiblePackages: false },
  environment: { globalVariables: {} },
  soundEffects: { enabled: true, genre: '90s pop' }
};

function readSettings() {
  try {
    if (!fsSync.existsSync(SETTINGS_FILE)) {
      fsSync.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return { ...DEFAULT_SETTINGS };
    }
    const data = fsSync.readFileSync(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    console.error('Error reading settings:', error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  const current = readSettings();
  const merged = {
    ai: { ...current.ai, ...settings.ai },
    installation: { ...current.installation, ...settings.installation },
    environment: settings.environment !== undefined
      ? { globalVariables: {}, ...settings.environment }
      : (current.environment || { globalVariables: {} }),
    soundEffects: { ...current.soundEffects, ...settings.soundEffects }
  };
  fsSync.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function redactForFrontend(settings) {
  const redacted = JSON.parse(JSON.stringify(settings));
  redacted._isAiConfigured = !!(redacted.ai.apiUrl && redacted.ai.apiUrl.trim() !== '' && redacted.ai.model && redacted.ai.model.trim() !== '');
  if (redacted.ai.apiKey) {
    const key = redacted.ai.apiKey;
    redacted.ai.apiKey = key.length > 8
      ? key.slice(0, 4) + '...' + key.slice(-4)
      : '••••••••';
  }
  return redacted;
}

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
// Install service is ESM — dynamic import works in Node but NOT in pkg binaries.
// Settings is inlined above (CJS-compatible). Install degrades gracefully.
let _installService = null;

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
          const svc = await getInstallService();
          svc.resolveQuestion(data.installId, data.questionId, data.answer);
        } catch { /* ignore if service not loaded (e.g. pkg binary) */ }
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

app.get('/api/settings', (req, res) => {
  try {
    res.json(redactForFrontend(readSettings()));
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

    const svc = await getInstallService();
    const installId = await svc.startInstallation(repoUrl, targetPath, existingTools, broadcastInstallProgress);
    res.json({ installId });
  } catch (error) {
    const isImportError = error.code === 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING';
    console.error('Install start error:', isImportError ? 'AI-assisted install not available in binary mode' : error);
    res.status(isImportError ? 501 : 500).json({ error: isImportError ? 'AI-assisted install is not available in standalone binary mode. Use npm or dev mode instead.' : error.message });
  }
});

app.post('/api/install/cancel/:installId', async (req, res) => {
  try {
    const svc = await getInstallService();
    const ok = svc.cancelInstallation(req.params.installId);
    res.json({ success: ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/install/status/:installId', async (req, res) => {
  try {
    const svc = await getInstallService();
    const state = svc.getInstallation(req.params.installId);
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
    const svc = await getInstallService();
    const log = await svc.getInstallLog(req.params.installId);
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

// ── Git Clone API (no AI required) ───────────────────────────

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

    // Extract repo name from URL for the clone folder
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

    if (runningProcesses.has(toolId)) {
      return res.status(409).json({ success: false, message: 'A process is already running for this tool' });
    }

    // Handle .sh scripts
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

    // Build environment: inherit system env + overlay custom vars
    const processEnv = { ...process.env };
    if (envVariables && typeof envVariables === 'object') {
      Object.assign(processEnv, envVariables);
    }

    try {
      const proc = exec(fullCommand, {
        shell: '/bin/bash',
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
        env: processEnv
      });
      runningProcesses.set(toolId, proc);
      broadcastProcessOutput(toolId, `$ ${fullCommand}`, 'command');

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

      proc.on('error', (error) => {
        broadcastProcessOutput(toolId, `Process error: ${error.message}`, 'error');
        runningProcesses.delete(toolId);
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
      broadcastProcessOutput(toolId, 'Stopping process...', 'info');

      // Kill process and all child processes
      if (proc.pid) {
        if (process.platform !== 'win32') {
          try {
            // Kill the entire process group (sends SIGTERM to all child processes)
            exec(`pkill -TERM -P ${proc.pid}`, (error) => {
              if (error) { /* ignore, fallback below */ }
              proc.kill('SIGTERM');
            });
          } catch {
            proc.kill();
          }
        } else {
          try {
            exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
              if (error) proc.kill();
            });
          } catch {
            proc.kill();
          }
        }
      } else {
        proc.kill();
      }

      runningProcesses.delete(toolId);
      broadcastProcessOutput(toolId, 'Process terminated by user', 'exit');
      await updateToolRunningStatus(toolId, false);
      res.json({ success: true });
    } catch (killError) {
      runningProcesses.delete(toolId);
      broadcastProcessOutput(toolId, `Error stopping process: ${killError.message}`, 'error');
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

// ── Auto-open in app mode ─────────────────────────────────────

function openAppWindow(url) {
  // Skip if --no-open flag or LP_PLAYER_NO_OPEN env is set
  if (args.includes('--no-open') || process.env.LP_PLAYER_NO_OPEN) return;

  const { execFile } = require('child_process');
  const { spawn } = require('child_process');
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS: use browser binary directly with execFile (no shell quoting issues)
    const browsers = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    const found = browsers.find(p => fsSync.existsSync(p));
    if (found) {
      console.log(`  \x1b[2mOpening app window via: ${path.basename(path.dirname(path.dirname(path.dirname(found))))}\x1b[0m`);
      const child = spawn(found, [`--app=${url}`], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      console.log('  \x1b[2mOpening in default browser\x1b[0m');
      exec(`open "${url}"`, () => {});
    }
  } else if (platform === 'win32') {
    const winBrowsers = [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env.PROGRAMFILES}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    ];
    const found = winBrowsers.find(p => p && fsSync.existsSync(p));
    if (found) {
      const child = spawn(found, [`--app=${url}`], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      exec(`start "" "${url}"`, () => {});
    }
  } else {
    // Linux
    const linuxBrowsers = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    const found = linuxBrowsers.find(p => fsSync.existsSync(p));
    if (found) {
      const child = spawn(found, [`--app=${url}`], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      exec(`xdg-open "${url}" 2>/dev/null`, () => {});
    }
  }
}

// Start the server
server.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = `http://${HOST === '0.0.0.0' ? getLocalIP() : HOST}:${PORT}`;
  console.log('');
  console.log(`  \x1b[32mLP Player is running\x1b[0m`);
  console.log('');
  console.log(`  \x1b[1mLocal:\x1b[0m   ${localUrl}`);
  if (HOST === '0.0.0.0') {
    console.log(`  \x1b[1mNetwork:\x1b[0m ${networkUrl}`);
  }
  console.log(`  \x1b[1mData:\x1b[0m    ${DATA_DIR}`);
  console.log('');

  // Auto-open app window
  openAppWindow(localUrl);
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
