import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { analyzeReadme } from './aiService.js';
import { readSettings } from './settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'installs');

// Active installations: installId -> installation state
const installations = new Map();

// ── Install Logger ───────────────────────────────────────────
async function ensureLogDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

function createInstallLogger(installId) {
  const lines = [];
  const logFile = path.join(LOGS_DIR, `${installId}.log`);

  const log = (level, message, data = null) => {
    const ts = new Date().toISOString();
    const entry = `[${ts}] [${level}] ${message}`;
    lines.push(data ? `${entry}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}` : entry);
    // Also print to server console
    const consoleFn = level === 'ERROR' ? console.error : console.log;
    consoleFn(`[install:${installId.slice(0, 8)}] ${message}`);
    if (data && level === 'ERROR') consoleFn(data);
  };

  const flush = async () => {
    try {
      await ensureLogDir();
      await fs.writeFile(logFile, lines.join('\n') + '\n', 'utf-8');
    } catch (e) {
      console.error('Failed to write install log:', e.message);
    }
  };

  return { log, flush, logFile, lines };
}

// Check if uv is available (cached)
let uvAvailable = null;
async function checkUv() {
  if (uvAvailable !== null) return uvAvailable;
  return new Promise(resolve => {
    exec('which uv', (err) => {
      uvAvailable = !err;
      resolve(uvAvailable);
    });
  });
}

function createInstallId() {
  return crypto.randomUUID();
}

// Detect what's already completed in a target directory to skip on re-runs
async function detectExistingState(targetPath) {
  const exists = async (name) => {
    try { await fs.access(path.join(targetPath, name)); return true; } catch { return false; }
  };

  const state = {
    hasVenv: await exists('.venv'),
    hasNodeModules: await exists('node_modules'),
    hasCargoTarget: await exists('target'),
    hasGoVendor: await exists('vendor'),
    installedBrewPkgs: []
  };

  // Check which brew packages are already installed (fast — just reads local DB)
  try {
    const result = await new Promise((resolve, reject) => {
      exec('brew list --formula -1', { timeout: 5000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim().split('\n').filter(Boolean));
      });
    });
    state.installedBrewPkgs = result;
  } catch { /* brew not available or failed — fine */ }

  return state;
}

// Check if a step can be skipped based on existing state
function canSkipStep(step, existingState) {
  const cmd = step.command;

  // Skip venv creation if .venv already exists
  if (cmd.includes('-m venv') && existingState.hasVenv) {
    return 'Virtual environment already exists';
  }

  // Skip npm/yarn/pnpm install if node_modules exists
  if (/\b(npm|yarn|pnpm)\s+install\b/.test(cmd) && existingState.hasNodeModules) {
    return 'node_modules already exists';
  }

  // Skip brew install if all packages in the command are already installed
  if (/\bbrew install\b/.test(cmd) && existingState.installedBrewPkgs.length > 0) {
    // Extract package names from "brew install pkg1 pkg2 ..."
    const brewPkgs = cmd.replace(/.*\bbrew install\b\s*/, '').trim().split(/\s+/).filter(p => !p.startsWith('-'));
    if (brewPkgs.length > 0 && brewPkgs.every(p => existingState.installedBrewPkgs.includes(p))) {
      return `Already installed via brew: ${brewPkgs.join(', ')}`;
    }
  }

  return null;
}

function getInstallation(installId) {
  return installations.get(installId);
}

function execCommand(command, cwd, envCommand = '', logger = null, onOutput = null) {
  return new Promise((resolve, reject) => {
    const fullCommand = envCommand
      ? `${envCommand} && ${command}`
      : command;

    if (logger) logger.log('CMD', `exec: ${fullCommand}`, `cwd: ${cwd}`);

    const proc = exec(fullCommand, {
      shell: '/bin/bash',
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data;
      if (onOutput) onOutput(String(data));
    });
    proc.stderr.on('data', (data) => {
      stderr += data;
      if (onOutput) onOutput(String(data));
    });

    // Store proc reference for cancellation
    const installId = proc._installId;
    if (installId) {
      const inst = installations.get(installId);
      if (inst) inst.currentProcess = proc;
    }

    proc.on('close', (code) => {
      if (code === 0) {
        if (logger) logger.log('OK', `exit 0: ${command.slice(0, 80)}`);
        resolve({ stdout, stderr, code });
      } else {
        if (logger) logger.log('ERROR', `exit ${code}: ${command.slice(0, 80)}`, { stdout: stdout.slice(-500), stderr: stderr.slice(-500) });
        reject({ stdout, stderr, code, command: fullCommand });
      }
    });

    proc.on('error', (err) => {
      if (logger) logger.log('ERROR', `exec error: ${err.message}`, { command: fullCommand, cwd });
      reject({ stdout, stderr, code: -1, command: fullCommand, error: err.message });
    });
  });
}

// Non-AI fallback: detect project type from files and build a basic plan
async function buildFallbackPlan(targetPath, readmeContent) {
  const projectName = path.basename(targetPath);
  let language = 'other';
  let packageManager = 'other';
  const steps = [];
  let runCommand = '';
  let activationCommand = '';

  // Detect project type by checking for config files
  const fileExists = async (name) => {
    try { await fs.access(path.join(targetPath, name)); return true; } catch { return false; }
  };

  const hasPkgJson = await fileExists('package.json');
  const hasRequirements = await fileExists('requirements.txt');
  const hasPyproject = await fileExists('pyproject.toml');
  const hasSetupPy = await fileExists('setup.py');
  const hasCargoToml = await fileExists('Cargo.toml');
  const hasGoMod = await fileExists('go.mod');
  const hasMakefile = await fileExists('Makefile');

  if (hasPkgJson) {
    language = 'node';
    // Detect package manager
    const hasYarnLock = await fileExists('yarn.lock');
    const hasPnpmLock = await fileExists('pnpm-lock.yaml');
    if (hasPnpmLock) {
      packageManager = 'pnpm';
      steps.push({ label: 'Install dependencies', command: 'pnpm install', workingDir: '.', critical: true });
    } else if (hasYarnLock) {
      packageManager = 'yarn';
      steps.push({ label: 'Install dependencies', command: 'yarn install', workingDir: '.', critical: true });
    } else {
      packageManager = 'npm';
      steps.push({ label: 'Install dependencies', command: 'npm install', workingDir: '.', critical: true });
    }
    // Try to read package.json for scripts and port
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(targetPath, 'package.json'), 'utf-8'));
      if (pkg.scripts?.start) runCommand = `${packageManager === 'npm' ? 'npm run' : packageManager} start`;
      else if (pkg.scripts?.dev) runCommand = `${packageManager === 'npm' ? 'npm run' : packageManager} dev`;
      else if (pkg.main) runCommand = `node ${pkg.main}`;
    } catch { /* ignore */ }
  } else if (hasRequirements || hasPyproject || hasSetupPy) {
    language = 'python';
    packageManager = 'pip';
    activationCommand = 'source .venv/bin/activate';
    steps.push({ label: 'Create virtual environment', command: 'python3 -m venv .venv', workingDir: '.', critical: true });
    if (hasRequirements) {
      steps.push({ label: 'Install dependencies', command: 'pip install -r requirements.txt', workingDir: '.', critical: true });
    } else if (hasPyproject) {
      steps.push({ label: 'Install dependencies', command: 'pip install -e .', workingDir: '.', critical: true });
    } else if (hasSetupPy) {
      steps.push({ label: 'Install dependencies', command: 'pip install -e .', workingDir: '.', critical: true });
    }
    runCommand = 'python main.py';
  } else if (hasCargoToml) {
    language = 'rust';
    packageManager = 'cargo';
    steps.push({ label: 'Build project', command: 'cargo build', workingDir: '.', critical: true });
    runCommand = 'cargo run';
  } else if (hasGoMod) {
    language = 'go';
    packageManager = 'go';
    steps.push({ label: 'Download modules', command: 'go mod download', workingDir: '.', critical: true });
    runCommand = 'go run .';
  } else if (hasMakefile) {
    steps.push({ label: 'Build project', command: 'make', workingDir: '.', critical: false });
  }

  // Try to extract port from README
  let port = '';
  const portMatch = readmeContent.match(/(?:port|PORT)\s*[:=]\s*(\d{3,5})/i)
    || readmeContent.match(/localhost:(\d{3,5})/i)
    || readmeContent.match(/--port\s+(\d{3,5})/i);
  if (portMatch) port = portMatch[1];

  return {
    projectName,
    description: `${projectName} (auto-detected, no AI)`,
    language,
    packageManager,
    port,
    category: 'application',
    tags: [language].filter(t => t !== 'other'),
    steps,
    runCommand,
    activationCommand,
    questions: []
  };
}

async function startInstallation(repoUrl, targetPath, existingTools, broadcast) {
  const installId = createInstallId();
  const settings = readSettings();
  const logger = createInstallLogger(installId);

  logger.log('INFO', `Installation started`, { repoUrl, targetPath, installId });

  const state = {
    installId,
    repoUrl,
    targetPath,
    phase: 'starting',
    plan: null,
    steps: [],
    currentStepIndex: -1,
    error: null,
    currentProcess: null,
    cancelled: false,
    pendingQuestion: null,
    questionResolver: null,
    logger
  };

  installations.set(installId, state);

  // Run the pipeline asynchronously
  runPipeline(state, existingTools, settings, broadcast).catch(err => {
    if (!state.cancelled) {
      state.phase = 'failed';
      state.error = err.message || String(err);
      logger.log('ERROR', `Pipeline failed: ${state.error}`);
      broadcast(installId, {
        phase: 'failed',
        error: state.error,
        step: state.steps[state.currentStepIndex] || null
      });
    }
  }).finally(() => {
    logger.log('INFO', `Installation ended — phase: ${state.phase}`);
    logger.flush();
    // Clean up after some time
    setTimeout(() => installations.delete(installId), 5 * 60 * 1000);
  });

  return installId;
}

async function runPipeline(state, existingTools, settings, broadcast) {
  const { installId, repoUrl, logger } = state;
  // Ensure targetPath is always absolute
  const targetPath = path.resolve(state.targetPath);
  state.targetPath = targetPath;

  // ── Phase 1: Clone ────────────────────────────────────────
  logger.log('PHASE', 'cloning');
  state.phase = 'cloning';
  broadcast(installId, { phase: 'cloning', step: { label: 'Cloning repository...', status: 'running' } });

  // Check if target already exists and is the same repo — resume instead of failing
  let alreadyCloned = false;
  let dirExists = false;
  logger.log('INFO', `Target path: "${targetPath}", Repo URL: "${repoUrl}"`);

  try {
    await fs.access(targetPath);
    dirExists = true;
    logger.log('INFO', `Target directory already exists, checking git remote...`);
  } catch {
    // Directory doesn't exist — will clone fresh
  }

  if (dirExists) {
    try {
      const result = await execCommand('git remote get-url origin', targetPath, '', logger);
      const existingRemote = result.stdout.trim().replace(/\.git$/, '');
      const incomingRemote = repoUrl.trim().replace(/\.git$/, '');
      logger.log('INFO', `Existing remote: "${existingRemote}", Incoming: "${incomingRemote}"`);

      if (existingRemote === incomingRemote) {
        alreadyCloned = true;
        logger.log('INFO', 'Same repo — pulling latest');
        try {
          await execCommand('git pull --ff-only', targetPath, '', logger);
        } catch (pullErr) {
          // Pull failed but repo exists — still treat as already cloned
          logger.log('INFO', `Pull failed (non-critical, repo still usable): ${pullErr.stderr || pullErr.error || ''}`);
          alreadyCloned = true;
        }
      } else {
        throw new Error(`Directory "${targetPath}" already exists but contains a different repository (${existingRemote})`);
      }
    } catch (gitErr) {
      // Re-throw our own Error messages
      if (gitErr instanceof Error) throw gitErr;
      // execCommand rejection — check if it's "not a git repository"
      const stderr = gitErr.stderr || '';
      if (stderr.includes('not a git repository')) {
        throw new Error(`Directory "${targetPath}" already exists and is not a git repository. Remove it first or choose a different path.`);
      }
      // Other git error — still a directory conflict
      throw new Error(`Directory "${targetPath}" already exists and git check failed: ${stderr || gitErr.error || 'unknown error'}`);
    }
  }

  if (!alreadyCloned) {
    try {
      await execCommand(`git clone --progress "${repoUrl}" "${targetPath}"`, process.cwd(), '', logger, (chunk) => {
        broadcast(installId, { phase: 'cloning', liveOutput: chunk });
      });
    } catch (err) {
      throw new Error(`Clone failed: ${err.stderr || err.error || 'Unknown error'}`);
    }
  }

  if (state.cancelled) return;
  broadcast(installId, { phase: 'cloning', step: { label: alreadyCloned ? 'Using existing clone...' : 'Cloning repository...', status: 'completed' } });

  // ── Phase 2: Read README ──────────────────────────────────
  logger.log('PHASE', 'reading-readme');
  state.phase = 'reading-readme';
  broadcast(installId, { phase: 'reading-readme', step: { label: 'Reading README...', status: 'running' } });

  let readmeContent = '';
  const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README.rst', 'README.txt', 'README'];
  for (const name of readmeNames) {
    try {
      readmeContent = await fs.readFile(path.join(targetPath, name), 'utf-8');
      break;
    } catch { /* try next */ }
  }

  if (!readmeContent) {
    throw new Error('No README found in the repository');
  }

  if (state.cancelled) return;
  broadcast(installId, { phase: 'reading-readme', step: { label: 'Reading README...', status: 'completed' } });

  // ── Phase 3: AI Analysis (or fallback) ──────────────────────
  const aiReady = settings.ai.apiUrl && settings.ai.model;
  logger.log('PHASE', aiReady ? 'ai-analyzing' : 'ai-analyzing (fallback, AI not configured)');
  state.phase = 'ai-analyzing';
  broadcast(installId, { phase: 'ai-analyzing', step: { label: aiReady ? 'AI is thinking...' : 'Generating install plan...', status: 'running' }, aiThinking: aiReady });

  // Check for previous install attempts on the same target to give AI context
  let previousInstallContext = '';
  if (alreadyCloned) {
    const existingStateForAI = await detectExistingState(targetPath);
    const contextParts = [];
    if (existingStateForAI.hasVenv) contextParts.push('Python .venv already exists');
    if (existingStateForAI.hasNodeModules) contextParts.push('node_modules already exists');
    if (existingStateForAI.installedBrewPkgs.length > 0) {
      contextParts.push(`Brew packages already installed: ${existingStateForAI.installedBrewPkgs.join(', ')}`);
    }
    if (contextParts.length > 0) {
      previousInstallContext = `\nPREVIOUS INSTALL STATE (this is a re-run, some things are already done):\n- ${contextParts.join('\n- ')}\nDo NOT include steps that are already done. Focus on what still needs to happen.`;
    }
    logger.log('INFO', 'Previous install context for AI', { previousInstallContext });
  }

  let plan;
  if (aiReady) {
    plan = await analyzeReadme(readmeContent, existingTools, { targetPath, previousInstallContext });
  } else {
    plan = await buildFallbackPlan(targetPath, readmeContent);
  }

  // Log raw AI response keys for debugging
  logger.log('INFO', 'AI raw plan keys: ' + Object.keys(plan).join(', '));
  if (!plan.steps) {
    logger.log('WARN', 'No "steps" field in AI plan. Full response:', JSON.stringify(plan, null, 2).slice(0, 2000));
  }

  // Normalize plan — ensure steps is always an array
  if (!plan.steps || !Array.isArray(plan.steps)) {
    // Some models nest steps differently — try common variants
    plan.steps = plan.step || plan.installSteps || plan.install_steps || plan.commands || [];
  }
  if (plan.steps.length === 0) {
    throw new Error('AI returned a plan with no installation steps. Please try again.');
  }

  state.plan = plan;
  // Stash readme for post-install analysis (not sent to client)
  plan._readmeContent = readmeContent;
  logger.log('PLAN', `AI plan received`, {
    projectName: plan.projectName,
    language: plan.language,
    packageManager: plan.packageManager,
    port: plan.port,
    activationCommand: plan.activationCommand,
    runCommand: plan.runCommand,
    steps: plan.steps.map(s => ({ label: s.label, command: s.command, critical: s.critical }))
  });

  if (state.cancelled) return;

  // ── Post-process the plan ─────────────────────────────────

  // Enforce Python venv if needed
  if (settings.installation.alwaysCreatePythonVenv && plan.language === 'python') {
    const hasVenvStep = plan.steps.some(s => s.command.includes('venv') || s.command.includes('virtualenv'));
    if (!hasVenvStep) {
      plan.steps.unshift({
        label: 'Create Python virtual environment',
        command: 'python3 -m venv .venv',
        workingDir: '.',
        critical: true
      });
    }
    if (!plan.activationCommand) {
      plan.activationCommand = 'source .venv/bin/activate';
    }
  }

  // Replace uv venv / uv init with python3 -m venv .venv
  plan.steps = plan.steps.map(s => {
    if (/\buv\s+(venv|init)\b/.test(s.command)) {
      return { ...s, command: 'python3 -m venv .venv' };
    }
    return s;
  });

  // Remove any steps that try to install uv itself — it's a system tool, not a venv package
  plan.steps = plan.steps.filter(s => {
    const cmd = s.command.toLowerCase();
    // Match: "pip install uv", "pip3 install uv", "uv pip install uv"
    return !/\bpip3?\s+install\s+uv\s*$/.test(cmd);
  });

  // Replace pip with uv if preferred and available
  if (settings.installation.preferUv) {
    const hasUv = await checkUv();
    if (hasUv) {
      plan.steps = plan.steps.map(s => ({
        ...s,
        command: s.command
          .replace(/(?<!\buv )\bpip3? install\b/g, 'uv pip install')
      }));
    }
  }

  // Add --no-config to all uv pip install commands to prevent reading pyproject.toml from project dirs
  plan.steps = plan.steps.map(s => ({
    ...s,
    command: s.command.replace(/\buv pip install\b(?!\s+--no-config)/g, 'uv pip install --no-config')
  }));

  // Port conflict check
  if (plan.port) {
    const conflict = existingTools.find(t => t.port && t.port === plan.port);
    if (conflict) {
      const suggestedPort = String(parseInt(plan.port) + 1);
      if (settings.installation.autoConfirmPortChanges) {
        // Auto-resolve: modify run command
        plan.runCommand = plan.runCommand.replace(plan.port, suggestedPort);
        plan.port = suggestedPort;
        plan.portConflictResolved = `Port auto-changed from ${conflict.port} (used by ${conflict.name}) to ${suggestedPort}`;
      } else {
        // Ask user
        const answer = await askQuestion(state, broadcast, {
          question: `Port ${plan.port} is already used by "${conflict.name}". Use port ${suggestedPort} instead?`,
          options: [`Use port ${suggestedPort}`, `Keep port ${plan.port} (will conflict)`],
          default: `Use port ${suggestedPort}`
        });
        if (answer.startsWith('Use port')) {
          plan.runCommand = plan.runCommand.replace(plan.port, suggestedPort);
          plan.port = suggestedPort;
        }
      }
    }
  }

  // Handle AI questions
  if (plan.questions && plan.questions.length > 0) {
    for (const q of plan.questions) {
      if (state.cancelled) return;
      await askQuestion(state, broadcast, q);
    }
  }

  // Strip internal fields before sending plan to client
  const clientPlan = { ...plan };
  delete clientPlan._readmeContent;

  broadcast(installId, { phase: 'ai-analyzing', step: { label: 'AI analyzing project...', status: 'completed' }, plan: clientPlan });

  // ── Phase 4: Wait for user approval if needed ─────────────
  if (!settings.installation.autoRunWithoutReview) {
    state.phase = 'awaiting-approval';
    broadcast(installId, { phase: 'awaiting-approval', plan: clientPlan });

    // Wait for the user to confirm
    await askQuestion(state, broadcast, {
      question: '__PLAN_APPROVAL__',
      options: ['Confirm & Install', 'Cancel'],
      default: 'Confirm & Install'
    }).then(answer => {
      if (answer === 'Cancel') {
        state.cancelled = true;
      }
    });

    if (state.cancelled) {
      broadcast(installId, { phase: 'cancelled' });
      return;
    }
  }

  // ── Phase 5: Execute Steps ────────────────────────────────
  logger.log('PHASE', 'executing', { stepCount: plan.steps.length, activationCommand: plan.activationCommand });
  state.phase = 'executing';
  state.steps = plan.steps.map((s, i) => ({
    ...s,
    index: i,
    status: 'pending',
    output: '',
    startedAt: null,
    completedAt: null
  }));

  broadcast(installId, { phase: 'executing', steps: state.steps });

  const activationCmd = plan.activationCommand || '';

  // Detect what's already installed to skip redundant steps on re-runs
  const existingState = await detectExistingState(targetPath);
  logger.log('INFO', 'Detected existing state', existingState);

  // Track whether the venv exists yet — only apply activation command AFTER venv is created
  let venvReady = existingState.hasVenv;

  for (let i = 0; i < state.steps.length; i++) {
    if (state.cancelled) return;

    const step = state.steps[i];
    state.currentStepIndex = i;

    // Check if step can be skipped
    const skipReason = canSkipStep(step, existingState);
    if (skipReason) {
      step.status = 'skipped';
      step.output = skipReason;
      step.startedAt = Date.now();
      step.completedAt = Date.now();
      logger.log('STEP', `[${i + 1}/${state.steps.length}] SKIPPED: ${step.label}`, { reason: skipReason });
      broadcast(installId, { phase: 'executing', step: { ...step }, stepIndex: i });
      // If this was the venv step and it was skipped (already exists), mark venv as ready
      if (step.command.includes('-m venv')) venvReady = true;
      continue;
    }

    step.status = 'running';
    step.startedAt = Date.now();
    logger.log('STEP', `[${i + 1}/${state.steps.length}] ${step.label}`, { command: step.command, workingDir: step.workingDir, critical: step.critical });
    broadcast(installId, { phase: 'executing', step: { ...step }, stepIndex: i });

    try {
      const workDir = path.resolve(targetPath, step.workingDir || '.');
      // Only apply activation command if venv exists AND this isn't the step creating it
      const isVenvCreation = step.command.includes('venv') && step.command.includes('-m venv');
      // Don't double-apply activation if the command already contains it
      const cmdAlreadyActivates = activationCmd && step.command.includes(activationCmd);
      const useActivation = venvReady && !isVenvCreation && !cmdAlreadyActivates && activationCmd;

      // Send command immediately so user sees something right away
      broadcast(installId, { phase: 'executing', stepIndex: i, liveOutput: `$ ${step.command}\n` });

      // Throttled live output streaming
      let outputBuffer = '';
      let flushTimer = null;
      const flushOutput = () => {
        if (outputBuffer) {
          broadcast(installId, { phase: 'executing', stepIndex: i, liveOutput: outputBuffer });
          outputBuffer = '';
        }
        flushTimer = null;
      };
      const onOutput = (chunk) => {
        outputBuffer += chunk;
        if (!flushTimer) flushTimer = setTimeout(flushOutput, 150);
      };

      const result = await execCommand(step.command, workDir, useActivation ? activationCmd : '', logger, onOutput);
      // Flush any remaining buffered output
      if (flushTimer) clearTimeout(flushTimer);
      flushOutput();

      // Mark venv as ready after its creation step succeeds
      if (isVenvCreation) venvReady = true;
      step.status = 'completed';
      step.output = result.stdout + (result.stderr ? '\n' + result.stderr : '');
      step.completedAt = Date.now();
    } catch (err) {
      step.status = 'failed';
      step.output = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.error || '');
      step.completedAt = Date.now();
      broadcast(installId, { phase: 'executing', step: { ...step }, stepIndex: i });

      // ── Smart recovery for Python dependency errors ──
      const errorText = step.output || '';
      const isPipInstall = step.command.includes('pip install') || step.command.includes('uv pip install');
      const isPythonVersionIssue = isPipInstall && (
        /does not satisfy Python/i.test(errorText) ||
        /requires-python/i.test(errorText) ||
        /No solution found when resolving/i.test(errorText) ||
        /version.*incompatible/i.test(errorText)
      );

      if (isPythonVersionIssue && step.critical) {
        // Detect current Python version from error or system
        const pyVerMatch = errorText.match(/Python\s*(?:version\s*)?\(?([\d.]+)\)?/i);
        const pyVer = pyVerMatch ? pyVerMatch[1] : 'current';

        // Extract incompatible package names from error text
        // Matches: "all versions of audioop-lts depend on Python>=3.13"
        //          "audioop-lts==0.2.2 depends on Python>=3.13"
        //          "audioop-lts depends on Python>=3.13"
        const incompatPkgs = new Set();
        const pkgPatterns = [
          /all versions of ([a-zA-Z][\w._-]*) depend on Python/gi,
          /([a-zA-Z][\w._-]*)==[\d.]+ depends on Python/gi,
          /\b([a-zA-Z][\w._-]*) depends on Python/gi
        ];
        for (const pattern of pkgPatterns) {
          let m;
          while ((m = pattern.exec(errorText)) !== null) {
            incompatPkgs.add(m[1].toLowerCase().replace(/_/g, '-'));
          }
        }
        const incompatList = [...incompatPkgs];

        // Determine if using a requirements file (-r <file>)
        const reqMatch = step.command.match(/-r\s+([\S]+)/);
        const reqFileName = reqMatch ? reqMatch[1] : null;

        const incompatMsg = incompatList.length > 0
          ? ` Incompatible packages: ${incompatList.join(', ')}.`
          : '';

        let answer;
        if (settings.installation.autoSkipIncompatiblePackages && incompatList.length > 0) {
          // Auto-skip: drop incompatible packages without asking
          answer = 'Retry: drop incompatible packages & version pins';
        } else {
          answer = await askQuestion(state, broadcast, {
            question: `Dependency install failed — some packages require a different Python version (you have ${pyVer}).${incompatMsg} How would you like to proceed?`,
            options: [
              'Retry: drop incompatible packages & version pins',
              'Retry with --no-deps (skip dependency checks)',
              'Cancel installation'
            ],
            default: 'Retry: drop incompatible packages & version pins'
          });
        }

        if (state.cancelled || answer === 'Cancel installation') {
          state.error = `Step "${step.label}" failed (exit code ${err.code})`;
          broadcast(installId, { phase: 'failed', step: { ...step }, stepIndex: i, error: state.error });
          throw new Error(state.error);
        }

        // Retry the step with modified command
        step.status = 'running';
        step.output = '';
        step.startedAt = Date.now();
        step.completedAt = null;
        broadcast(installId, { phase: 'executing', step: { ...step }, stepIndex: i });

        try {
          let retryCommand = step.command;

          if (answer.startsWith('Retry: drop')) {
            if (reqFileName) {
              // Create a relaxed requirements file:
              // 1. Strip version pins
              // 2. Remove packages that are entirely incompatible with current Python
              const workDir = path.resolve(targetPath, step.workingDir || '.');
              const origReqPath = path.resolve(workDir, reqFileName);
              const reqContent = await fs.readFile(origReqPath, 'utf-8');
              const relaxedLines = [];
              const excluded = [];

              for (const line of reqContent.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                  relaxedLines.push(trimmed);
                  continue;
                }
                // Extract package name (before any version specifier, @, or [extras])
                const pkgName = trimmed.split(/[=<>!~@[\s]/)[0].toLowerCase().replace(/_/g, '-');
                if (incompatPkgs.has(pkgName)) {
                  excluded.push(pkgName);
                  relaxedLines.push(`# EXCLUDED (requires different Python): ${trimmed}`);
                  continue;
                }
                // Keep git+ URLs as-is
                if (trimmed.includes('git+') || trimmed.includes('@ ')) {
                  relaxedLines.push(trimmed);
                } else {
                  // Strip version specifiers
                  relaxedLines.push(trimmed.replace(/[><=!~]=?.*$/, '').trim());
                }
              }
              const relaxedPath = path.join(workDir, 'requirements-relaxed.txt');
              await fs.writeFile(relaxedPath, relaxedLines.join('\n'), 'utf-8');
              retryCommand = retryCommand.replace(/-r\s+[\S]+/, '-r requirements-relaxed.txt');
              if (excluded.length > 0) {
                step.label = `${step.label} (excluded: ${excluded.join(', ')})`;
              }
            }
          } else if (answer.startsWith('Retry with --no-deps')) {
            retryCommand = retryCommand.replace(/(pip install)/, '$1 --no-deps');
          }

          const workDir = path.resolve(targetPath, step.workingDir || '.');
          const isVenvCreation = step.command.includes('venv') && step.command.includes('-m venv');
          const cmdAlreadyActivates = activationCmd && retryCommand.includes(activationCmd);
          const useActivation = venvReady && !isVenvCreation && !cmdAlreadyActivates && activationCmd;
          logger.log('RETRY', `Retrying step: ${step.label}`, { retryCommand, workDir });

          broadcast(installId, { phase: 'executing', stepIndex: i, liveOutput: `$ ${retryCommand} (retry)\n` });

          let retryOutputBuffer = '';
          let retryFlushTimer = null;
          const retryFlushOutput = () => {
            if (retryOutputBuffer) {
              broadcast(installId, { phase: 'executing', stepIndex: i, liveOutput: retryOutputBuffer });
              retryOutputBuffer = '';
            }
            retryFlushTimer = null;
          };
          const retryOnOutput = (chunk) => {
            retryOutputBuffer += chunk;
            if (!retryFlushTimer) retryFlushTimer = setTimeout(retryFlushOutput, 150);
          };

          const result = await execCommand(retryCommand, workDir, useActivation ? activationCmd : '', logger, retryOnOutput);
          if (retryFlushTimer) clearTimeout(retryFlushTimer);
          retryFlushOutput();
          step.status = 'completed';
          step.output = result.stdout + (result.stderr ? '\n' + result.stderr : '');
          step.completedAt = Date.now();
          step.label = step.label + ' (relaxed)';
        } catch (retryErr) {
          step.status = 'failed';
          step.output = (retryErr.stdout || '') + '\n' + (retryErr.stderr || '') + '\n' + (retryErr.error || '');
          step.completedAt = Date.now();
          state.error = `Step "${step.label}" failed on retry (exit code ${retryErr.code})`;
          broadcast(installId, { phase: 'failed', step: { ...step }, stepIndex: i, error: state.error });
          throw new Error(state.error);
        }
      } else if (step.critical) {
        state.error = `Step "${step.label}" failed (exit code ${err.code})`;
        broadcast(installId, { phase: 'failed', step: { ...step }, stepIndex: i, error: state.error });
        throw new Error(state.error);
      } else {
        // Non-critical: mark as warning but continue
        step.status = 'warning';
      }
    }

    broadcast(installId, { phase: 'executing', step: { ...step }, stepIndex: i });
  }

  // ── Build post-install report ───────────────────────────────
  const postInstallNotes = [];
  for (const s of state.steps) {
    if (s.status === 'skipped') {
      postInstallNotes.push({ type: 'skipped', label: s.label, detail: s.output || '' });
    } else if (s.status === 'warning') {
      postInstallNotes.push({ type: 'warning', label: s.label, detail: s.output || '' });
    }
  }
  // Check for common post-install tasks from README hints
  const readmeHints = [];
  if (plan._readmeContent) {
    const readme = plan._readmeContent.toLowerCase();
    if (readme.includes('huggingface') || readme.includes('hugging face') || readme.includes('hf_token') || readme.includes('hf token')) {
      readmeHints.push('Download model weights from HuggingFace (may require HF_TOKEN or login)');
    }
    if (readme.includes('.env.example') || readme.includes('copy .env')) {
      readmeHints.push('Copy .env.example to .env and configure environment variables');
    }
    if (readme.includes('license') && (readme.includes('accept') || readme.includes('agree') || readme.includes('approval'))) {
      readmeHints.push('Accept model/software license agreement');
    }
    if (readme.includes('api_key') || readme.includes('api key') || readme.includes('apikey')) {
      readmeHints.push('Configure API key(s) in environment or config file');
    }
  }
  if (readmeHints.length > 0) {
    for (const hint of readmeHints) {
      postInstallNotes.push({ type: 'reminder', label: hint, detail: 'Found in README' });
    }
  }
  if (postInstallNotes.length > 0) {
    logger.log('INFO', 'Post-install notes', postInstallNotes);
  }

  // ── Phase 6: Register Tool ────────────────────────────────
  state.phase = 'registering';
  broadcast(installId, { phase: 'registering', step: { label: 'Registering project...', status: 'running' } });

  // Generate a default vinyl SVG icon with a random color
  const vinylColors = ['#bccc0f','#22c55e','#3b82f6','#a855f7','#ec4899','#f97316','#ef4444','#06b6d4','#14b8a6','#8b5cf6'];
  const vinylColor = vinylColors[Math.floor(Math.random() * vinylColors.length)];
  const vinylSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="56" height="56"><circle cx="50" cy="50" r="45" fill="none" stroke="${vinylColor}" stroke-width="5"/><circle cx="50" cy="50" r="20" fill="none" stroke="${vinylColor}" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="${vinylColor}"/><line x1="50" y1="5" x2="50" y2="20" stroke="${vinylColor}" stroke-width="2"/></svg>`;
  const logoPath = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vinylSvg)}`;

  const tool = {
    name: plan.projectName || path.basename(targetPath),
    description: plan.description || '',
    logoPath,
    category: plan.category || 'application',
    tags: plan.tags || [],
    port: plan.port || '',
    execution: {
      rootPath: path.resolve(targetPath),
      command: plan.runCommand || '',
      environment: {
        activationCommand: plan.activationCommand || ''
      },
      isRunning: false
    }
  };

  broadcast(installId, { phase: 'registering', step: { label: 'Registering project...', status: 'completed' }, tool });

  // ── Done ──────────────────────────────────────────────────
  state.phase = 'completed';
  broadcast(installId, { phase: 'completed', plan: clientPlan, tool, postInstallNotes: postInstallNotes.length > 0 ? postInstallNotes : undefined });
}

function askQuestion(state, broadcast, question) {
  return new Promise((resolve) => {
    const questionId = crypto.randomUUID();
    state.pendingQuestion = { ...question, questionId };
    state.questionResolver = resolve;

    broadcast(state.installId, {
      phase: state.phase,
      question: { ...question, questionId }
    });
  });
}

function resolveQuestion(installId, questionId, answer) {
  const state = installations.get(installId);
  if (!state || !state.pendingQuestion || state.pendingQuestion.questionId !== questionId) return false;

  const resolver = state.questionResolver;
  state.pendingQuestion = null;
  state.questionResolver = null;
  if (resolver) resolver(answer);
  return true;
}

function cancelInstallation(installId) {
  const state = installations.get(installId);
  if (!state) return false;

  state.cancelled = true;
  if (state.currentProcess) {
    try {
      process.kill(-state.currentProcess.pid, 'SIGTERM');
    } catch {
      try { state.currentProcess.kill('SIGTERM'); } catch { /* ignore */ }
    }
  }
  // Resolve any pending question so the pipeline can exit
  if (state.questionResolver) {
    state.questionResolver('Cancel');
  }

  // Clean up partially cloned directory
  if (state.targetPath) {
    fs.rm(state.targetPath, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
  }

  return true;
}

async function getInstallLog(installId) {
  const logFile = path.join(LOGS_DIR, `${installId}.log`);
  try {
    return await fs.readFile(logFile, 'utf-8');
  } catch {
    // If log file doesn't exist yet, try to get from active state
    const state = installations.get(installId);
    if (state?.logger?.lines) {
      return state.logger.lines.join('\n');
    }
    return null;
  }
}

export { startInstallation, getInstallation, resolveQuestion, cancelInstallation, getInstallLog };
