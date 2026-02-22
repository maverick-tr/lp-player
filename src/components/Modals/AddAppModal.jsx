import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { useTools } from '../../hooks/useTools';
import { useTheme } from '../../hooks/useTheme';
import { useSettings } from '../../hooks/useSettings';
import InstallProgressPanel from '../Install/InstallProgressPanel';

// Array of possible vinyl colors to use for default images
const DEFAULT_COLORS = [
  '#bccc0f', // Yellow (app theme color)
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#8b5cf6'  // Violet
];

function AddAppModal({ onClose, existingTool = null, isEditing = false }) {
  const { isDarkMode } = useTheme();
  const { addApp, updateApp, tools: allTools } = useTools();
  
  // Function to find a color not already used by other apps
  const getUniqueColor = () => {
    // Extract all colors already used in default vinyl logos
    const usedColors = allTools
      .filter(tool => tool.logoPath && tool.logoPath.includes('default_vynl.svg?color='))
      .map(tool => {
        const match = tool.logoPath.match(/color=([^&]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
      
    // Find available colors
    const availableColors = DEFAULT_COLORS.filter(color => 
      !usedColors.includes(encodeURIComponent(color))
    );
    
    // If all colors are used, pick a random one, otherwise pick a random available color
    if (availableColors.length === 0) {
      return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    } else {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
  };
  
  // Generate a random color for the default vinyl image
  const defaultVinylColor = useRef(getUniqueColor());

  const [appData, setAppData] = useState(
    existingTool || {
      name: '',
      description: '',
      logoPath: '',
      category: 'application',
      tags: [],
      port: '',
      execution: {
        rootPath: '',
        environment: {
          activationCommand: ''
        },
        command: '',
        isRunning: false
      }
    }
  );
  // Per-project environment variables
  const [envVarEntries, setEnvVarEntries] = useState(() => {
    const vars = existingTool?.execution?.environment?.variables || {};
    const entries = Object.entries(vars).map(([key, value]) => ({ key, value }));
    return entries;
  });

  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [categoryInput, setCategoryInput] = useState(existingTool ? existingTool.category : 'application');
  const [error, setError] = useState('');
  const [showGitInstall, setShowGitInstall] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitTargetPath, setGitTargetPath] = useState('');
  const [portWarning, setPortWarning] = useState('');
  // AI install state
  const [installState, setInstallState] = useState(null); // { phase, plan, steps, question, error }
  const [installId, setInstallId] = useState(null);
  const wsRef = useRef(null);
  const { settings, isAiConfigured } = useSettings();
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingEnv, setDetectingEnv] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef(null);

  // Extract all existing tags and categories for autocomplete
  const existingTags = Array.from(new Set(allTools.flatMap(tool => tool.tags)));
  const existingCategories = Array.from(new Set(allTools.map(tool => tool.category)));

  // Check for port conflicts
  useEffect(() => {
    if (appData.port) {
      // Check if the port is already in use by another tool
      const conflictingTool = allTools.find(tool => 
        tool.port === appData.port && (!isEditing || tool.id !== appData.id)
      );
      
      if (conflictingTool) {
        setPortWarning(`Warning: Port ${appData.port} is already used by "${conflictingTool.name}"`);
      } else {
        setPortWarning('');
      }
    } else {
      setPortWarning('');
    }
  }, [appData.port, allTools, isEditing, appData.id]);

  const [savedSinceOpen, setSavedSinceOpen] = useState(false);
  const [initialSnapshot] = useState(() => JSON.stringify(existingTool || null));

  const hasChanges = (() => {
    if (savedSinceOpen) return false;
    if (isEditing) {
      // Compare current state against the original tool
      return JSON.stringify(appData) !== initialSnapshot;
    }
    // For new apps, check if user has entered anything
    return appData.name !== '' ||
      appData.description !== '' ||
      appData.logoPath !== '' ||
      appData.category !== 'application' ||
      appData.tags.length > 0 ||
      appData.port !== '' ||
      appData.execution.rootPath !== '' ||
      appData.execution.command !== '' ||
      envVarEntries.length > 0;
  })();
    
  const handleCloseClick = () => {
    if (hasChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setAppData({
        ...appData,
        [parent]: {
          ...appData[parent],
          [child]: value
        }
      });
    } else if (name.includes('environment.')) {
      const [_, property] = name.split('environment.');
      setAppData({
        ...appData,
        execution: {
          ...appData.execution,
          environment: {
            ...appData.execution.environment,
            [property]: value
          }
        }
      });
    } else {
      setAppData({
        ...appData,
        [name]: value
      });
    }
  };

  const handlePortChange = (e) => {
    const value = e.target.value;
    
    // Only allow numeric input
    if (value === '' || /^\d+$/.test(value)) {
      setAppData({
        ...appData,
        port: value
      });
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app, you would upload this file to a server
      // For this demo, we'll use a local URL and store the path
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
        // In a real implementation, you'd get a path from the server
        setAppData({
          ...appData,
          logoPath: `uploads/${file.name}`
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Check if a string looks like a URL
  const isUrl = (str) => /^https?:\/\/.+/i.test(str);

  // Fetch image from URL (direct image or favicon)
  const handleFetchLogo = async () => {
    const url = appData.logoPath?.trim();
    if (!url || !isUrl(url)) return;
    setFetchingLogo(true);
    setError('');
    try {
      const res = await fetch(`http://${window.location.hostname}:4243/api/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success && data.dataUri) {
        setImagePreview(data.dataUri);
        setAppData(prev => ({ ...prev, logoPath: data.dataUri }));
      } else {
        setError(data.error || 'Could not fetch image from URL');
      }
    } catch (err) {
      setError(`Failed to fetch image: ${err.message}`);
    } finally {
      setFetchingLogo(false);
    }
  };

  const handleTagInputChange = (e) => {
    const input = e.target.value;
    setTagInput(input);
    
    if (input.trim()) {
      // Filter tags that include the current input (case insensitive)
      const filteredSuggestions = existingTags.filter(tag => 
        tag.toLowerCase().includes(input.toLowerCase()) && 
        !appData.tags.includes(tag)
      );
      setTagSuggestions(filteredSuggestions);
      setShowTagSuggestions(filteredSuggestions.length > 0);
    } else {
      setTagSuggestions([]);
      setShowTagSuggestions(false);
    }
  };

  const handleCategoryInputChange = (e) => {
    setCategoryInput(e.target.value);
    setAppData({
      ...appData,
      category: e.target.value
    });
  };

  const handleSelectCategory = (category) => {
    setCategoryInput(category);
    setAppData({
      ...appData,
      category
    });
    setShowCategoryDropdown(false);
  };

  const handleSelectTag = (tag) => {
    if (!appData.tags.includes(tag)) {
      setAppData({
        ...appData,
        tags: [...appData.tags, tag]
      });
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleTagAdd = () => {
    if (tagInput.trim() && !appData.tags.includes(tagInput.trim())) {
      setAppData({
        ...appData,
        tags: [...appData.tags, tagInput.trim()]
      });
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setAppData({
      ...appData,
      tags: appData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const detectEnvironment = async () => {
    if (!appData.execution.rootPath) {
      setError('Please enter a root path first');
      return;
    }

    setDetectingEnv(true);
    setError('');

    try {
      // Make an API call to check if various environment files exist
      const response = await fetch(`http://${window.location.hostname}:4243/api/detect-environment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rootPath: appData.execution.rootPath
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with error (${response.status})`);
      }

      const result = await response.json();
      
      let activationCommand = '';
      if (result.hasPythonVenv) {
        activationCommand = 'source .venv/bin/activate';
      } else if (result.hasConda) {
        activationCommand = 'conda activate env-name';
      }
      setAppData({
        ...appData,
        execution: {
          ...appData.execution,
          environment: {
            ...appData.execution.environment,
            activationCommand
          }
        }
      });
    } catch (error) {
      console.error('Error detecting environment:', error);
      setError(`Failed to detect environment: ${error.message}`);
    } finally {
      setDetectingEnv(false);
    }
  };

  const handleEnvironmentCommandChange = (e) => {
    const value = e.target.value;
    setAppData({
      ...appData,
      execution: {
        ...appData.execution,
        environment: {
          ...appData.execution.environment,
          activationCommand: value
        }
      }
    });
  };

  // WebSocket connection for install progress
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const connectInstallWs = useCallback((id) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`ws://${window.location.hostname}:4243`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe-install', installId: id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'install-progress' || data.installId !== id) return;

        setInstallState(prev => {
          const next = { ...prev, phase: data.phase };

          if (data.plan) next.plan = data.plan;
          if (data.error) next.error = data.error;
          if (data.question) next.question = data.question;
          if (data.postInstallNotes) next.postInstallNotes = data.postInstallNotes;

          // Update steps array
          if (data.steps) {
            next.steps = data.steps;
          } else if (data.step && data.stepIndex !== undefined && prev?.steps) {
            const steps = [...prev.steps];
            steps[data.stepIndex] = data.step;
            next.steps = steps;
          } else if (data.step && data.phase === 'executing' && !prev?.steps) {
            next.steps = [data.step];
          }

          // Append live output to running step or phase
          if (data.liveOutput !== undefined) {
            if (data.stepIndex !== undefined && next.steps) {
              const steps = [...(next.steps)];
              if (steps[data.stepIndex]) {
                steps[data.stepIndex] = {
                  ...steps[data.stepIndex],
                  liveOutput: (steps[data.stepIndex].liveOutput || '') + data.liveOutput
                };
                next.steps = steps;
              }
            } else {
              // Phase-level output (e.g. cloning progress)
              next.phaseLiveOutput = (prev?.phaseLiveOutput || '') + data.liveOutput;
            }
          }
          // Clear phase output when phase changes
          if (data.phase !== prev?.phase) {
            next.phaseLiveOutput = '';
          }

          // Tool registration on completion
          if (data.phase === 'completed' && data.tool) {
            addApp(data.tool);
          }

          return next;
        });
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      setInstallState(prev => prev ? { ...prev, phase: 'failed', error: 'WebSocket connection lost' } : null);
    };
  }, [addApp]);

  const handleGitInstall = async (e) => {
    e.preventDefault();
    setError('');

    if (!gitRepoUrl) {
      setError('Git repository URL is required');
      return;
    }

    if (!gitTargetPath) {
      setError('Target directory is required');
      return;
    }

    // Initialize install state
    setInstallState({ phase: 'starting', plan: null, steps: [], question: null, error: null });

    try {
      const response = await fetch(`http://${window.location.hostname}:4243/api/install/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: gitRepoUrl, targetPath: gitTargetPath })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Server responded with ${response.status}`);
      }

      const { installId: id } = await response.json();
      setInstallId(id);
      connectInstallWs(id);
    } catch (err) {
      setInstallState({ phase: 'failed', plan: null, steps: [], question: null, error: err.message });
    }
  };

  const handleInstallAnswer = useCallback((questionId, answer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && installId) {
      wsRef.current.send(JSON.stringify({
        type: 'install-answer',
        installId,
        questionId,
        answer
      }));
      // Clear the question from state
      setInstallState(prev => prev ? { ...prev, question: null } : null);
    }
  }, [installId]);

  const handleInstallCancel = useCallback(async () => {
    if (installId) {
      try {
        await fetch(`http://${window.location.hostname}:4243/api/install/cancel/${installId}`, {
          method: 'POST'
        });
      } catch { /* ignore */ }
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setInstallState(null);
    setInstallId(null);
  }, [installId]);

  const handleBackFromGitInstall = () => {
    if (installState && installState.phase !== 'completed' && installState.phase !== 'failed' && installState.phase !== 'cancelled') {
      handleInstallCancel();
    }
    setInstallState(null);
    setInstallId(null);
    setShowGitInstall(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!appData.name) {
      setError('App name is required');
      return;
    }
    
    if (!appData.execution.rootPath) {
      setError('Root path is required');
      return;
    }
    
    if (!appData.execution.command) {
      setError('Command is required');
      return;
    }
    
    // Validate port is a number if provided
    if (appData.port && !(/^\d+$/.test(appData.port))) {
      setError('Port must be a valid number');
      return;
    }
    
    // Build per-project env variables object
    const projectVariables = {};
    envVarEntries.forEach(({ key, value }) => {
      if (key.trim()) {
        projectVariables[key.trim()] = value;
      }
    });

    // If no logo path is provided, use the default vinyl SVG with the random color
    const finalAppData = {
      ...appData,
      logoPath: appData.logoPath || generateVinylSvgDataUri(defaultVinylColor.current),
      execution: {
        ...appData.execution,
        environment: {
          ...appData.execution.environment,
          variables: projectVariables
        }
      }
    };
    
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        const result = await updateApp(finalAppData);
        if (result) {
          setSavedSinceOpen(true);
          setSuccess('App updated successfully!');
          setTimeout(() => onClose(), 800);
        } else {
          setError('Failed to update app. Please try again.');
        }
      } else {
        const result = await addApp(finalAppData);
        if (result) {
          setSavedSinceOpen(true);
          setSuccess('App added successfully!');
          setTimeout(() => onClose(), 800);
        } else {
          setError('Failed to add app. Please try again.');
        }
      }
    } catch (error) {
      setError(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to generate an inline SVG data URI with the specified color
  const generateVinylSvgDataUri = (color) => {
    const encodedSvg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="56" height="56">
        <circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="5" />
        <circle cx="50" cy="50" r="20" fill="none" stroke="${color}" stroke-width="3" />
        <circle cx="50" cy="50" r="5" fill="${color}" />
        <line x1="50" y1="5" x2="50" y2="20" stroke="${color}" stroke-width="2" />
      </svg>
    `);
    return `data:image/svg+xml;charset=UTF-8,${encodedSvg}`;
  };

  return (
    <Dialog open={true} onClose={handleCloseClick} className="relative z-50">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`
          w-full max-w-lg rounded-xl p-4 shadow-2xl overflow-y-auto max-h-[85vh]
          ${isDarkMode
            ? 'bg-gradient-to-br from-[#bccc0f]/15 to-tool-dark border border-[#bccc0f]/25'
            : 'bg-gray-50 border border-[#7a8a0b]/40'
          }
        `}>
          <Dialog.Title className={`
            text-lg font-bold mb-3
            ${isDarkMode ? 'text-[#bccc0f]/80' : 'text-[#4a5a06]'}
          `}>
            {showGitInstall ? 'Install from Git' : isEditing ? 'Edit App' : 'Add New App'}
          </Dialog.Title>

          {showGitInstall ? (
            <div className="space-y-3">
              {/* AI indicator */}
              {isAiConfigured ? (
                <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  AI-powered install
                </div>
              ) : (
                <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  AI not configured — <span className="underline cursor-pointer" onClick={() => { /* user can open settings from header */ }}>configure in Settings</span>
                </div>
              )}

              {/* Show form if not yet installing */}
              {!installState ? (
                <form onSubmit={handleGitInstall} className="space-y-3">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Git Repository URL*
                    </label>
                    <input
                      type="text"
                      value={gitRepoUrl}
                      onChange={(e) => setGitRepoUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Target Directory*
                    </label>
                    <input
                      type="text"
                      value={gitTargetPath}
                      onChange={(e) => setGitTargetPath(e.target.value)}
                      placeholder="/path/to/install"
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                      required
                    />
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleBackFromGitInstall}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                          : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                      }`}
                    >
                      Install
                    </button>
                  </div>
                </form>
              ) : (
                /* Install in progress — show progress panel */
                <div className="space-y-3">
                  <InstallProgressPanel
                    installState={installState}
                    installId={installId}
                    onAnswer={handleInstallAnswer}
                    onCancel={handleInstallCancel}
                    isDarkMode={isDarkMode}
                  />

                  {/* Back / Close button after completion or failure */}
                  {(installState.phase === 'completed' || installState.phase === 'failed' || installState.phase === 'cancelled') && (
                    <div className="flex justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleBackFromGitInstall}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
                        }`}
                      >
                        {installState.phase === 'completed' ? 'Close' : 'Back'}
                      </button>
                      {installState.phase === 'completed' && (
                        <button
                          type="button"
                          onClick={onClose}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                              : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                          }`}
                        >
                          Done
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => setShowGitInstall(true)}
                  className={`px-4 py-2 rounded-md ${isDarkMode ? 'bg-[#bccc0f]/70 hover:bg-[#bccc0f]/60 text-black' : 'bg-[#7a8a0b] hover:bg-[#6b7a08] text-white'}`}
                >
                  Install from Git Repository
                </button>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-400"></div>
                <span className={`flex-shrink mx-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>or</span>
                <div className="flex-grow border-t border-gray-400"></div>
              </div>

              {/* Basic App Info */}
            <div>
              <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                App Name*
              </label>
              <input
                type="text"
                name="name"
                value={appData.name}
                onChange={handleInputChange}
                className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                required
              />
            </div>

            <div>
              <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Description
              </label>
              <input
                type="text"
                name="description"
                value={appData.description}
                onChange={handleInputChange}
                className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Port Number (Optional)
                </label>
                <input
                  type="text"
                  name="port"
                  value={appData.port}
                  onChange={handlePortChange}
                  placeholder="e.g. 3000, 8080"
                  className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                />
                {portWarning && (
                  <p className="text-yellow-400 text-xs mt-1">{portWarning}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Category
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={categoryInput}
                    onChange={handleCategoryInputChange}
                    onFocus={() => setShowCategoryDropdown(true)}
                    className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                    placeholder="Select category"
                  />
                  {showCategoryDropdown && (
                    <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg ${
                      isDarkMode ? 'bg-tool-dark border border-[#bccc0f]/25' : 'bg-white border border-gray-300'
                    }`}>
                      <ul className="py-1 max-h-32 overflow-auto">
                        {existingCategories.map(category => (
                          <li 
                            key={category}
                            className={`px-3 py-1 cursor-pointer text-sm ${
                              isDarkMode 
                                ? 'hover:bg-[#bccc0f]/10 text-white' 
                                : 'hover:bg-gray-100 text-black'
                            }`}
                            onClick={() => handleSelectCategory(category)}
                          >
                            {category}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Logo
              </label>
              <div className="flex gap-2 items-start">
                <div className={`w-12 h-12 border rounded-md overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                  {fetchingLogo ? (
                    <span className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: isDarkMode ? '#bccc0f80' : '#7a8a0b', borderTopColor: 'transparent' }} />
                  ) : imagePreview ? (
                    <img src={imagePreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  ) : appData.logoPath && !isUrl(appData.logoPath) ? (
                    <img src={appData.logoPath} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-xs text-gray-400 text-center flex flex-col items-center justify-center">
                      <img
                        src={generateVinylSvgDataUri(defaultVinylColor.current)}
                        alt="Default vinyl"
                        width="28"
                        height="28"
                        className="mx-auto"
                      />
                      <span className="text-[7px] mt-1">Vinyl</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className={`px-2 py-1 rounded-lg text-xs ${
                          isDarkMode
                            ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                            : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                        }`}
                      >
                        Upload
                      </button>
                      {isUrl(appData.logoPath) && (
                        <button
                          type="button"
                          onClick={handleFetchLogo}
                          disabled={fetchingLogo}
                          className={`px-2 py-1 rounded-lg text-xs ${
                            isDarkMode
                              ? 'bg-blue-600/70 text-white hover:bg-blue-600/50'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50`}
                        >
                          {fetchingLogo ? 'Fetching...' : 'Fetch'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      name="logoPath"
                      value={appData.logoPath}
                      onChange={handleInputChange}
                      placeholder="Image path or URL (https://...)"
                      className={`form-input w-full text-xs py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Tags
              </label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onFocus={() => setShowTagSuggestions(tagSuggestions.length > 0)}
                    className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                    placeholder="Add a tag"
                  />
                  <button
                    type="button"
                    onClick={handleTagAdd}
                    className={`px-2 py-1 rounded-lg text-xs ${
                      isDarkMode 
                        ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                        : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                    }`}
                  >
                    Add
                  </button>
                </div>
                
                {showTagSuggestions && (
                  <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg ${
                    isDarkMode ? 'bg-tool-dark border border-[#bccc0f]/25' : 'bg-white border border-gray-300'
                  }`}>
                    <ul className="py-1 max-h-32 overflow-auto">
                      {tagSuggestions.map(tag => (
                        <li 
                          key={tag}
                          className={`px-3 py-1 cursor-pointer text-sm ${
                            isDarkMode 
                              ? 'hover:bg-[#bccc0f]/10 text-white' 
                              : 'hover:bg-gray-100 text-black'
                          }`}
                          onClick={() => handleSelectTag(tag)}
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1 mt-1">
                {appData.tags.map((tag, index) => (
                  <span 
                    key={index}
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isDarkMode ? 'bg-[#bccc0f]/15 text-[#bccc0f]/70' : 'bg-[#7a8a0b]/15 text-[#4a5a06]'
                    }`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="text-xs hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Execution Settings */}
            <div className="border-t pt-3 mt-2 border-gray-600">
              <h3 className={`font-medium mb-2 text-sm ${isDarkMode ? 'text-[#bccc0f]/80' : 'text-[#4a5a06]'}`}>
                Execution Settings
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Root Path*
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="execution.rootPath"
                      value={appData.execution.rootPath}
                      onChange={handleInputChange}
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={detectEnvironment}
                      disabled={detectingEnv}
                      className={`px-2 py-1 rounded-lg whitespace-nowrap text-xs ${
                        isDarkMode
                          ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                          : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                      } ${detectingEnv ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {detectingEnv ? 'Detecting...' : 'Detect Env'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Environment Command
                    </label>
                    <input
                      type="text"
                      name="environment.activationCommand"
                      value={appData.execution.environment.activationCommand}
                      onChange={handleEnvironmentCommandChange}
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                      placeholder="e.g. source .venv/bin/activate"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Command*
                    </label>
                    <input
                      type="text"
                      name="execution.command"
                      value={appData.execution.command}
                      onChange={handleInputChange}
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                      placeholder="e.g. python app.py"
                      required
                    />
                  </div>
                </div>

                {/* Per-project Environment Variables */}
                <div className="mt-3">
                  <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Environment Variables
                  </label>
                  <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Project-specific variables override global settings
                  </p>

                  {envVarEntries.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {envVarEntries.map((entry, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={entry.key}
                            onChange={e => {
                              const updated = [...envVarEntries];
                              updated[i] = { ...updated[i], key: e.target.value };
                              setEnvVarEntries(updated);
                            }}
                            placeholder="KEY"
                            className={`form-input flex-[2] py-1 text-xs font-mono ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                          />
                          <input
                            type="text"
                            value={entry.value}
                            onChange={e => {
                              const updated = [...envVarEntries];
                              updated[i] = { ...updated[i], value: e.target.value };
                              setEnvVarEntries(updated);
                            }}
                            placeholder="value"
                            className={`form-input flex-[3] py-1 text-xs font-mono ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/25 text-white' : 'bg-white border-gray-300 text-black'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setEnvVarEntries(prev => prev.filter((_, idx) => idx !== i))}
                            className={`p-1 rounded transition-colors shrink-0 ${
                              isDarkMode
                                ? 'text-gray-500 hover:text-red-400'
                                : 'text-gray-400 hover:text-red-500'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setEnvVarEntries(prev => [...prev, { key: '', value: '' }])}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                      isDarkMode
                        ? 'text-[#bccc0f]/70 hover:text-[#bccc0f]'
                        : 'text-[#7a8a0b] hover:text-[#4a5a06]'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Variable
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCloseClick}
                disabled={isSubmitting}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  isDarkMode
                    ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                    : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update' : 'Add')}
              </button>
            </div>
          </form>
          )}
        </Dialog.Panel>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className={`p-6 rounded-xl shadow-2xl ${
            isDarkMode 
              ? 'bg-gradient-to-br from-[#bccc0f]/15 to-tool-dark border border-[#bccc0f]/25 text-white'
              : 'bg-gray-50 border border-[#7a8a0b]/40 text-black'
          }`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-[#bccc0f]/80' : 'text-[#4a5a06]'}`}>Discard Changes?</h2>
            <p>You have unsaved changes. Are you sure you want to close without saving?</p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleCancelClose}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className={`px-4 py-2 rounded-lg ${
                  isDarkMode 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default AddAppModal; 