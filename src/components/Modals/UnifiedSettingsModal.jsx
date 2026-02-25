import { useState, useEffect } from 'react';
import { Dialog, Tab } from '@headlessui/react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../hooks/useTheme';
import { useSettings } from '../../hooks/useSettings';

function UnifiedSettingsModal({ onClose }) {
  const { isDarkMode, toggleTheme, sepiaValue, setSepiaValue, hueValue, setHueValue } = useTheme();
  const { settings, updateSettings, testAiConnection } = useSettings();

  // AI state
  const [aiUrl, setAiUrl] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Installation state
  const [autoConfirmPort, setAutoConfirmPort] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [alwaysVenv, setAlwaysVenv] = useState(true);
  const [preferUv, setPreferUv] = useState(true);
  const [autoSkipIncompat, setAutoSkipIncompat] = useState(false);

  // Environment state
  const [envEntries, setEnvEntries] = useState([]);
  const [defaultProjectsFolder, setDefaultProjectsFolder] = useState('');

  // UV detection state
  const [uvStatus, setUvStatus] = useState(null); // null | { installed, version }

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundGenre, setSoundGenre] = useState('90s pop');

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load settings into local state
  useEffect(() => {
    if (settings) {
      setAiUrl(settings.ai?.apiUrl || '');
      setAiKey('');
      setAiModel(settings.ai?.model || '');
      setAutoConfirmPort(settings.installation?.autoConfirmPortChanges || false);
      setAutoRun(settings.installation?.autoRunWithoutReview || false);
      setAlwaysVenv(settings.installation?.alwaysCreatePythonVenv !== false);
      setPreferUv(settings.installation?.preferUv !== false);
      setAutoSkipIncompat(settings.installation?.autoSkipIncompatiblePackages || false);

      // Load global env vars
      const globalVars = settings.environment?.globalVariables || {};
      const entries = Object.entries(globalVars).map(([key, value]) => ({ key, value }));
      setEnvEntries(entries.length > 0 ? entries : []);

      // Load sound settings
      setSoundEnabled(settings.soundEffects?.enabled !== false);
      setSoundGenre(settings.soundEffects?.genre || '90s pop');

      // Load paths
      setDefaultProjectsFolder(settings.paths?.defaultProjectsFolder || '');
    }
  }, [settings]);

  // Check UV installation on mount
  useEffect(() => {
    fetch(`${window.location.origin}/api/check-uv`)
      .then(res => res.json())
      .then(data => setUvStatus(data))
      .catch(() => setUvStatus({ installed: false, version: null }));
  }, []);

  const handleSave = async (tabIndex) => {
    setSaving(true);
    setError('');
    setSuccess('');

    const updates = {};

    if (tabIndex === 1) {
      // AI tab (includes installation preferences)
      updates.ai = {
        apiUrl: aiUrl,
        model: aiModel,
        ...(aiKey ? { apiKey: aiKey } : {})
      };
      updates.installation = {
        autoConfirmPortChanges: autoConfirmPort,
        autoRunWithoutReview: autoRun,
        alwaysCreatePythonVenv: alwaysVenv,
        preferUv: preferUv,
        autoSkipIncompatiblePackages: autoSkipIncompat
      };
    } else if (tabIndex === 2) {
      // Environment tab
      const globalVariables = {};
      envEntries.forEach(({ key, value }) => {
        if (key.trim()) {
          globalVariables[key.trim()] = value;
        }
      });
      updates.environment = { globalVariables };
      updates.paths = { defaultProjectsFolder: defaultProjectsFolder.trim() };
    } else if (tabIndex === 3) {
      // Sound tab
      updates.soundEffects = {
        enabled: soundEnabled,
        genre: soundGenre
      };
    }

    const ok = await updateSettings(updates);
    setSaving(false);
    if (ok) {
      setSuccess('Settings saved');
      if (tabIndex === 1) setAiKey('');
      setTimeout(() => setSuccess(''), 2000);
    } else {
      setError('Failed to save settings');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    if (aiKey) {
      await updateSettings({ ai: { apiUrl: aiUrl, apiKey: aiKey, model: aiModel } });
      setAiKey('');
    }
    const result = await testAiConnection();
    setTestResult(result);
    setTesting(false);
  };

  const addEnvEntry = () => {
    setEnvEntries(prev => [...prev, { key: '', value: '' }]);
  };

  const removeEnvEntry = (index) => {
    setEnvEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateEnvEntry = (index, field, value) => {
    setEnvEntries(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const inputClass = `form-input w-full py-1.5 px-3 rounded-lg text-sm ${
    isDarkMode
      ? 'bg-tool-dark border border-[#bccc0f]/25 text-white placeholder-gray-500'
      : 'bg-white border border-gray-300 text-black placeholder-gray-400'
  }`;

  const labelClass = `block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;

  const tabNames = ['Appearance', 'AI', 'Environment', 'Sound'];

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`
          w-full max-w-md rounded-xl shadow-2xl overflow-hidden
          ${isDarkMode
            ? 'bg-gradient-to-br from-[#bccc0f]/15 to-tool-dark border border-[#bccc0f]/25'
            : 'bg-gray-50 border border-[#7a8a0b]/40'
          }
        `}>
          <Tab.Group>
            {({ selectedIndex }) => (
              <>
                {/* Header with close button */}
                <div className={`flex items-center justify-between px-5 pt-4 pb-2`}>
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-[#bccc0f]/80' : 'text-[#4a5a06]'}`}>Settings</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`p-1 rounded-lg transition-colors ${
                      isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-black hover:bg-gray-200'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Tab bar */}
                <Tab.List className={`flex border-b ${isDarkMode ? 'border-[#bccc0f]/15' : 'border-gray-200'}`}>
                  {tabNames.map((name) => (
                    <Tab key={name} className={({ selected }) => `
                      flex-1 py-2.5 text-xs font-medium transition-colors outline-none
                      ${selected
                        ? (isDarkMode
                          ? 'text-[#bccc0f] border-b-2 border-[#bccc0f]'
                          : 'text-[#4a5a06] border-b-2 border-[#7a8a0b]')
                        : (isDarkMode
                          ? 'text-gray-500 hover:text-gray-300'
                          : 'text-gray-400 hover:text-gray-600')
                      }
                    `}>
                      {name}
                    </Tab>
                  ))}
                </Tab.List>

                <div className="p-5 overflow-y-auto max-h-[70vh]">
                  <Tab.Panels>
                    {/* ---- Appearance Tab ---- */}
                    <Tab.Panel className="space-y-4">
                      {/* Dark/Light Toggle */}
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}>
                          Dark Mode
                        </span>
                        <button
                          onClick={toggleTheme}
                          className={`
                            p-2 rounded-full transition-colors
                            ${isDarkMode
                              ? 'bg-tool-light hover:bg-tool-accent-light'
                              : 'bg-tool-light-mode-card hover:bg-gray-200'
                            }
                          `}
                        >
                          {isDarkMode ? (
                            <SunIcon className="w-5 h-5 text-[#bccc0f]" />
                          ) : (
                            <MoonIcon className="w-5 h-5 text-tool-light-mode-accent" />
                          )}
                        </button>
                      </div>

                      {/* Sepia Slider */}
                      <div className="space-y-1">
                        <label htmlFor="sepiaSlider" className={labelClass}>Sepia</label>
                        <input
                          id="sepiaSlider"
                          type="range"
                          min="0"
                          max="100"
                          value={sepiaValue}
                          onChange={e => setSepiaValue(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 slider-thumb"
                        />
                        <span className={`text-[10px] block text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{sepiaValue}%</span>
                      </div>

                      {/* Hue Rotation Slider */}
                      <div className="space-y-1">
                        <label htmlFor="hueSlider" className={labelClass}>Color Hue</label>
                        <input
                          id="hueSlider"
                          type="range"
                          min="0"
                          max="360"
                          value={hueValue}
                          onChange={e => setHueValue(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer hue-slider-thumb"
                        />
                        <span className={`text-[10px] block text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{hueValue}°</span>
                      </div>

                      <p className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Changes apply immediately
                      </p>

                      {/* Slider thumb styles */}
                      <style>{`
                        .slider-thumb::-webkit-slider-thumb,
                        .hue-slider-thumb::-webkit-slider-thumb {
                          -webkit-appearance: none;
                          appearance: none;
                          width: 14px;
                          height: 14px;
                          background: ${isDarkMode ? '#bccc0f' : '#5856d6'};
                          border-radius: 50%;
                          cursor: pointer;
                        }
                        .slider-thumb::-moz-range-thumb,
                        .hue-slider-thumb::-moz-range-thumb {
                          width: 14px;
                          height: 14px;
                          background: ${isDarkMode ? '#bccc0f' : '#5856d6'};
                          border-radius: 50%;
                          cursor: pointer;
                          border: none;
                        }
                        input[type=range]#hueSlider {
                          background: linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%));
                        }
                      `}</style>
                    </Tab.Panel>

                    {/* ---- AI Tab ---- */}
                    <Tab.Panel className="space-y-3">
                      <div>
                        <label className={labelClass}>API URL</label>
                        <input
                          type="text"
                          value={aiUrl}
                          onChange={e => setAiUrl(e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>API Key</label>
                        <input
                          type="password"
                          value={aiKey}
                          onChange={e => setAiKey(e.target.value)}
                          placeholder={settings?.ai?.apiKey || 'Enter API key'}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Model</label>
                        <input
                          type="text"
                          value={aiModel}
                          onChange={e => setAiModel(e.target.value)}
                          placeholder="gpt-4o"
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isDarkMode
                            ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                            : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                        } ${testing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {testing ? 'Testing...' : 'Test Connection'}
                      </button>
                      {testResult && (
                        <p className={`text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult.success ? `Connected — ${testResult.models?.length || 0} models available` : testResult.error}
                        </p>
                      )}

                      {/* AI Install Preferences */}
                      <div className={`border-t pt-3 mt-1 ${isDarkMode ? 'border-[#bccc0f]/15' : 'border-gray-200'}`}>
                        <p className={`text-xs font-medium mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>AI Install Preferences</p>
                        <div className="space-y-3">
                          <Toggle label="Auto-run without plan review" description="Skip the plan review step and execute immediately" value={autoRun} onChange={setAutoRun} isDarkMode={isDarkMode} />
                          <Toggle label="Auto-resolve port conflicts" description="Automatically use an alternative port without asking" value={autoConfirmPort} onChange={setAutoConfirmPort} isDarkMode={isDarkMode} />
                          <Toggle label="Always create Python venv" description="Create a virtual environment for Python projects even if not in README" value={alwaysVenv} onChange={setAlwaysVenv} isDarkMode={isDarkMode} />
                          <Toggle label="Prefer uv for Python" description="Use uv instead of pip when available" value={preferUv} onChange={setPreferUv} isDarkMode={isDarkMode} />
                          {uvStatus && (
                            <div className="ml-12 -mt-1">
                              {uvStatus.installed ? (
                                <span className="text-xs text-green-400">&#10003; uv {uvStatus.version} detected</span>
                              ) : (
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  uv is not installed.{' '}
                                  <a
                                    href="https://docs.astral.sh/uv/getting-started/installation/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={isDarkMode ? 'text-[#bccc0f]/70 hover:text-[#bccc0f]' : 'text-[#7a8a0b] hover:text-[#4a5a06]'}
                                  >
                                    Install uv
                                  </a>
                                </span>
                              )}
                            </div>
                          )}
                          <Toggle label="Auto-skip incompatible packages" description="Automatically drop packages that require a different Python version" value={autoSkipIncompat} onChange={setAutoSkipIncompat} isDarkMode={isDarkMode} />
                        </div>
                      </div>
                    </Tab.Panel>

                    {/* ---- Environment Tab ---- */}
                    <Tab.Panel className="space-y-3">
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Global environment variables are injected into every project at launch. Per-project variables can override these in project settings.
                      </p>

                      {envEntries.length === 0 ? (
                        <div className={`text-center py-6 rounded-lg border border-dashed ${
                          isDarkMode ? 'border-gray-700 text-gray-600' : 'border-gray-300 text-gray-400'
                        }`}>
                          <p className="text-sm">No global environment variables configured</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {envEntries.map((entry, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={entry.key}
                                onChange={e => updateEnvEntry(i, 'key', e.target.value)}
                                placeholder="KEY"
                                className={`${inputClass} flex-[2] font-mono`}
                              />
                              <input
                                type="text"
                                value={entry.value}
                                onChange={e => updateEnvEntry(i, 'value', e.target.value)}
                                placeholder="value"
                                className={`${inputClass} flex-[3] font-mono`}
                              />
                              <button
                                type="button"
                                onClick={() => removeEnvEntry(i)}
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                  isDarkMode
                                    ? 'text-gray-500 hover:text-red-400 hover:bg-red-400/10'
                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addEnvEntry}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                          isDarkMode
                            ? 'text-[#bccc0f]/70 hover:text-[#bccc0f]'
                            : 'text-[#7a8a0b] hover:text-[#4a5a06]'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Variable
                      </button>

                      {/* Default Projects Folder */}
                      <div className={`border-t pt-3 mt-3 ${isDarkMode ? 'border-[#bccc0f]/15' : 'border-gray-200'}`}>
                        <label className={labelClass}>Default Projects Folder</label>
                        <input
                          type="text"
                          value={defaultProjectsFolder}
                          onChange={e => setDefaultProjectsFolder(e.target.value)}
                          placeholder={`${
                            typeof window !== 'undefined' && navigator.platform?.includes('Mac')
                              ? '/Users/you/Projects'
                              : '/home/you/Projects'
                          }`}
                          className={inputClass}
                        />
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Default directory for cloning and creating new projects
                        </p>
                      </div>
                    </Tab.Panel>

                    {/* ---- Sound Tab ---- */}
                    <Tab.Panel className="space-y-4">
                      <Toggle
                        label="Sound Effects"
                        description="Play vinyl crackle and music preview when launching a project"
                        value={soundEnabled}
                        onChange={setSoundEnabled}
                        isDarkMode={isDarkMode}
                      />

                      <div>
                        <label className={labelClass}>Music Genre</label>
                        <select
                          value={soundGenre}
                          onChange={e => setSoundGenre(e.target.value)}
                          className={`${inputClass} cursor-pointer`}
                        >
                          <option value="90s pop">90s Pop</option>
                          <option value="80s rock">80s Rock</option>
                          <option value="jazz">Jazz</option>
                          <option value="classical">Classical</option>
                          <option value="electronic">Electronic</option>
                          <option value="lo-fi">Lo-Fi</option>
                          <option value="hip hop">Hip Hop</option>
                          <option value="r&b/soul">R&B / Soul</option>
                          <option value="funk">Funk</option>
                          <option value="ambient">Ambient</option>
                        </select>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          A random track preview from this genre plays each time you launch a project.
                        </p>
                      </div>
                    </Tab.Panel>
                  </Tab.Panels>

                  {/* Feedback messages */}
                  {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
                  {success && <p className="text-green-400 text-sm mt-3">{success}</p>}
                </div>

                {/* Footer - hidden on Appearance tab */}
                {selectedIndex !== 0 && (
                  <div className={`flex justify-end gap-3 px-5 py-3 border-t ${isDarkMode ? 'border-[#bccc0f]/15' : 'border-gray-200'}`}>
                    <button
                      type="button"
                      onClick={onClose}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(selectedIndex)}
                      disabled={saving}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                          : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                      } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </>
            )}
          </Tab.Group>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function Toggle({ label, description, value, onChange, isDarkMode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors
            ${value
              ? (isDarkMode ? 'bg-[#bccc0f]/70' : 'bg-[#7a8a0b]')
              : (isDarkMode ? 'bg-gray-600' : 'bg-gray-300')
            }
          `}
        >
          <span className={`
            inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform
            ${value ? 'translate-x-4' : 'translate-x-0.5'}
          `} />
        </button>
      </div>
      <div>
        <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-black'}`}>{label}</div>
        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{description}</div>
      </div>
    </label>
  );
}

export default UnifiedSettingsModal;
