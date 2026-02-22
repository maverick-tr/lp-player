import fs from 'fs';
import { SETTINGS_FILE } from './dataDir.js';

const SETTINGS_PATH = SETTINGS_FILE;

const DEFAULT_SETTINGS = {
  ai: {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o'
  },
  installation: {
    autoConfirmPortChanges: false,
    autoRunWithoutReview: false,
    alwaysCreatePythonVenv: true,
    preferUv: true,
    autoSkipIncompatiblePackages: false
  },
  environment: {
    globalVariables: {}
  },
  soundEffects: {
    enabled: true,
    genre: '90s pop'
  }
};

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return { ...DEFAULT_SETTINGS };
    }
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    console.error('Error reading settings:', error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  try {
    const current = readSettings();
    const merged = {
      ai: { ...current.ai, ...settings.ai },
      installation: { ...current.installation, ...settings.installation },
      // Replace environment entirely when present (so deleted vars don't persist)
      environment: settings.environment !== undefined
        ? { globalVariables: {}, ...settings.environment }
        : (current.environment || { globalVariables: {} }),
      soundEffects: { ...current.soundEffects, ...settings.soundEffects }
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
    return merged;
  } catch (error) {
    console.error('Error writing settings:', error.message);
    throw error;
  }
}

function redactForFrontend(settings) {
  const redacted = JSON.parse(JSON.stringify(settings));
  // AI is configured if URL and model are set (API key is optional for local AI)
  redacted._isAiConfigured = !!(redacted.ai.apiUrl && redacted.ai.apiUrl.trim() !== '' && redacted.ai.model && redacted.ai.model.trim() !== '');
  if (redacted.ai.apiKey) {
    const key = redacted.ai.apiKey;
    redacted.ai.apiKey = key.length > 8
      ? key.slice(0, 4) + '...' + key.slice(-4)
      : '••••••••';
  }
  return redacted;
}

export { readSettings, writeSettings, redactForFrontend, DEFAULT_SETTINGS };
