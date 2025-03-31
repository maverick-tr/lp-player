import { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { useTools } from '../../hooks/useTools';
import { useTheme } from '../../hooks/useTheme';

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
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [categoryInput, setCategoryInput] = useState(existingTool ? existingTool.category : 'application');
  const [error, setError] = useState('');
  const [portWarning, setPortWarning] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingEnv, setDetectingEnv] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
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

  const hasChanges = appData.name !== '' || 
    appData.description !== '' || 
    appData.logoPath !== '' ||
    appData.category !== 'application' ||
    appData.tags.length > 0 ||
    appData.port !== '' ||
    appData.execution.rootPath !== '' ||
    appData.execution.command !== '';
    
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
      
      if (result.hasPythonVenv) {
        setAppData({
          ...appData,
          execution: {
            ...appData.execution,
            environment: {
              activationCommand: 'source .venv/bin/activate'
            }
          }
        });
      } else if (result.hasConda) {
        setAppData({
          ...appData,
          execution: {
            ...appData.execution,
            environment: {
              activationCommand: 'conda activate env-name'
            }
          }
        });
      } else if (result.hasNodeModules) {
        setAppData({
          ...appData,
          execution: {
            ...appData.execution,
            environment: {
              activationCommand: ''
            }
          }
        });
      } else if (result.hasDotEnv) {
        // If .env file is detected but no other environment, don't suggest conda
        setAppData({
          ...appData,
          execution: {
            ...appData.execution,
            environment: {
              activationCommand: ''
            }
          }
        });
      } else {
        setAppData({
          ...appData,
          execution: {
            ...appData.execution,
            environment: {
              activationCommand: ''
            }
          }
        });
      }
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
          activationCommand: value
        }
      }
    });
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
    
    // If no logo path is provided, use the default vinyl SVG with the random color
    const finalAppData = {
      ...appData,
      logoPath: appData.logoPath || generateVinylSvgDataUri(defaultVinylColor.current)
    };
    
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        const result = await updateApp(finalAppData);
        if (result) {
          setSuccess('App updated successfully!');
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError('Failed to update app. Please try again.');
        }
      } else {
        const result = await addApp(finalAppData);
        if (result) {
          setSuccess('App added successfully!');
          setTimeout(() => {
            onClose();
          }, 1500);
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
            ? 'bg-gradient-to-br from-[#bccc0f]/40 to-tool-dark border border-[#bccc0f]/50' 
            : 'bg-white border-2 border-[#bccc0f]'
          }
        `}>
          <Dialog.Title className={`
            text-lg font-bold mb-3
            ${isDarkMode ? 'text-[#bccc0f]' : 'text-black'}
          `}>
            {isEditing ? 'Edit App' : 'Add New App'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-3">
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
                className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
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
                className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
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
                  className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
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
                    className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
                    placeholder="Select category"
                  />
                  {showCategoryDropdown && (
                    <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg ${
                      isDarkMode ? 'bg-tool-dark border border-[#bccc0f]/50' : 'bg-white border border-gray-300'
                    }`}>
                      <ul className="py-1 max-h-32 overflow-auto">
                        {existingCategories.map(category => (
                          <li 
                            key={category}
                            className={`px-3 py-1 cursor-pointer text-sm ${
                              isDarkMode 
                                ? 'hover:bg-[#bccc0f]/20 text-white' 
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
                <div className="w-12 h-12 border rounded-md overflow-hidden flex items-center justify-center bg-gray-100">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  ) : appData.logoPath ? (
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className={`px-2 py-1 rounded-lg text-xs ${
                        isDarkMode 
                          ? 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
                          : 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
                      }`}
                    >
                      Upload Image
                    </button>
                    <input
                      type="text"
                      name="logoPath"
                      value={appData.logoPath}
                      onChange={handleInputChange}
                      placeholder="Or enter image path"
                      className={`form-input w-full text-xs py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
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
                    className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
                    placeholder="Add a tag"
                  />
                  <button
                    type="button"
                    onClick={handleTagAdd}
                    className={`px-2 py-1 rounded-lg text-xs ${
                      isDarkMode 
                        ? 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
                        : 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
                    }`}
                  >
                    Add
                  </button>
                </div>
                
                {showTagSuggestions && (
                  <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg ${
                    isDarkMode ? 'bg-tool-dark border border-[#bccc0f]/50' : 'bg-white border border-gray-300'
                  }`}>
                    <ul className="py-1 max-h-32 overflow-auto">
                      {tagSuggestions.map(tag => (
                        <li 
                          key={tag}
                          className={`px-3 py-1 cursor-pointer text-sm ${
                            isDarkMode 
                              ? 'hover:bg-[#bccc0f]/20 text-white' 
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
                      isDarkMode ? 'bg-[#bccc0f]/30 text-[#bccc0f]' : 'bg-[#bccc0f]/20 text-black'
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
              <h3 className={`font-medium mb-2 text-sm ${isDarkMode ? 'text-[#bccc0f]' : 'text-black'}`}>
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
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={detectEnvironment}
                      disabled={detectingEnv}
                      className={`px-2 py-1 rounded-lg whitespace-nowrap text-xs ${
                        isDarkMode 
                          ? 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90' 
                          : 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
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
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
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
                      className={`form-input w-full py-1 ${isDarkMode ? 'bg-tool-dark border-[#bccc0f]/50 text-white' : 'bg-white border-gray-300 text-black'}`}
                      placeholder="e.g. python app.py"
                      required
                    />
                  </div>
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
                    ? 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90' 
                    : 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update' : 'Add')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className={`p-6 rounded-xl shadow-2xl ${
            isDarkMode 
              ? 'bg-gradient-to-br from-[#bccc0f]/40 to-tool-dark border border-[#bccc0f]/50 text-white' 
              : 'bg-white border-2 border-[#bccc0f] text-black'
          }`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-[#bccc0f]' : 'text-black'}`}>Discard Changes?</h2>
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