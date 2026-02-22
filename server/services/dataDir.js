import envPaths from 'env-paths';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundled defaults (shipped with the package)
const DEFAULTS_DIR = path.join(__dirname, '..', '..', 'src', 'data');

// Resolve data directory: env var override > env-paths OS standard
const DATA_DIR = process.env.LP_PLAYER_DATA_DIR || envPaths('LP Player', { suffix: '' }).data;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Copy a default file to the data directory on first run
function ensureFile(filename, defaultContent) {
  const target = path.join(DATA_DIR, filename);
  if (!fs.existsSync(target)) {
    const source = path.join(DEFAULTS_DIR, filename);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      console.log(`[LP Player] Initialized ${filename} in ${DATA_DIR}`);
    } else {
      fs.writeFileSync(target, JSON.stringify(defaultContent, null, 2));
      console.log(`[LP Player] Created default ${filename} in ${DATA_DIR}`);
    }
  }
  return target;
}

const TOOLS_FILE = ensureFile('tools.json', { tools: [] });
const SETTINGS_FILE = ensureFile('settings.json', {
  ai: { apiUrl: '', apiKey: '', model: '' },
  installation: {
    autoConfirmPortChanges: false,
    autoRunWithoutReview: false,
    alwaysCreatePythonVenv: true,
    preferUv: true,
    autoSkipIncompatiblePackages: false
  },
  environment: { globalVariables: {} },
  soundEffects: { enabled: true, genre: '90s pop' }
});

export { DATA_DIR, TOOLS_FILE, SETTINGS_FILE };
