import { createContext, useState, useCallback, useRef, useLayoutEffect } from 'react';
// Remove this import to prevent double loading
// import toolsData from '../data/tools.json';
import { executeProcess, killProcess, openInBrowser } from '../utils/processExecutor';

// Define the API base URL - adjust this to match your actual server URL
const API_BASE_URL = `http://${window.location.hostname}:3015`;

// Export the context directly
export const ToolContext = createContext();

// Keep loaded data between component unmounts/remounts for StrictMode
let globalToolsCache = null;

// This becomes our named export component
export function ToolProvider({ children }) {
  const hasInitialized = useRef(false);
  const isCurrentlyFetching = useRef(false);
  
  // Initialize state with cached data if available
  const [tools, setTools] = useState(globalToolsCache || []);
  const [filteredTools, setFilteredTools] = useState(globalToolsCache || []);
  
  // Use useLayoutEffect to run synchronously before browser paint
  useLayoutEffect(() => {
    if (hasInitialized.current || isCurrentlyFetching.current) return;
    isCurrentlyFetching.current = true;
    
    console.log('Loading tools...');
    
    const loadTools = async () => {
      try {
        let loadedTools = [];
        let source = '';
        
        // If we have cached tools, use them immediately
        if (globalToolsCache && globalToolsCache.length > 0) {
          loadedTools = globalToolsCache;
          setTools(globalToolsCache);
          setFilteredTools(globalToolsCache);
          source = 'cache';
          console.log('Initial load from cache');
        }
        // Otherwise try localStorage
        else {
          const savedTools = localStorage.getItem('lap_tools');
          if (savedTools) {
            try {
              const parsedTools = JSON.parse(savedTools);
              if (Array.isArray(parsedTools) && parsedTools.length > 0) {
                loadedTools = parsedTools;
                setTools(parsedTools);
                setFilteredTools(parsedTools);
                // Save to global cache
                globalToolsCache = parsedTools;
                source = 'localStorage';
                console.log('Initial load from localStorage');
              }
            } catch (parseError) {
              console.error('Failed to parse saved tools:', parseError);
            }
          }
        }
        
        // Regardless of initial source, always try to get fresh data from API
        const response = await fetch(`${API_BASE_URL}/api/tools`).catch(err => {
          console.warn('API server not available:', err.message);
          return null;
        });
        
        if (response && response.ok) {
          const data = await response.json();
          if (data.tools && Array.isArray(data.tools)) {
            const apiTools = data.tools;
            
            // Only update if API data is different from what we have
            const currentToolsJSON = JSON.stringify(loadedTools);
            const apiToolsJSON = JSON.stringify(apiTools);
            
            if (currentToolsJSON !== apiToolsJSON) {
              setTools(apiTools);
              setFilteredTools(apiTools);
              // Update global cache
              globalToolsCache = apiTools;
              // Save to localStorage
              localStorage.setItem('lap_tools', apiToolsJSON);
              source = source ? `${source} → API` : 'API';
            }
          }
        }
        
        // If all fail, show an empty state
        if (loadedTools.length === 0) {
          console.error('Failed to load tools from any source');
          source = 'empty state';
        }
        
        console.log(`Loaded tools from ${source}`);
        hasInitialized.current = true;
      } catch (error) {
        console.error('Error loading tools:', error);
        if (tools.length === 0) {
          setTools([]);
          setFilteredTools([]);
        }
        hasInitialized.current = true;
      } finally {
        isCurrentlyFetching.current = false;
      }
    };
    
    loadTools();
  }, []);

  // Filter function
  const filterTools = useCallback((searchTerm) => {
    if (!searchTerm) {
      setFilteredTools(tools);
      return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const filtered = tools.filter(tool => {
      return (
        tool.name.toLowerCase().includes(searchLower) ||
        tool.description.toLowerCase().includes(searchLower) ||
        (tool.tags || []).some(tag => tag.toLowerCase().includes(searchLower)) ||
        (tool.category || '').toLowerCase().includes(searchLower)
      );
    });
    
    setFilteredTools(filtered);
  }, [tools]);

  // In a real app, this would be an API call to persist changes to the backend
  const persistTools = async (updatedTools) => {
    try {
      // Update global cache
      globalToolsCache = updatedTools;
      
      // Save to localStorage for client-side persistence
      localStorage.setItem('lap_tools', JSON.stringify(updatedTools));
      
      // Save to server's tools.json via API
      try {
        const response = await fetch(`${API_BASE_URL}/api/tools`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tools: updatedTools }),
        }).catch(err => {
          console.warn('API server not available for saving:', err.message);
          return null;
        });
        
        if (response && !response.ok) {
          console.error('Server responded with an error:', await response.text());
        } else if (response) {
          console.log('Tools saved to server successfully');
        } else {
          console.log('Changes saved to localStorage only (server unavailable)');
        }
      } catch (serverError) {
        console.error('Error saving to server, but changes saved locally:', serverError);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to persist tools:', error);
      return false;
    }
  };

  const runApp = async (toolId) => {
    try {
      const tool = tools.find(t => t.id === toolId);
      if (!tool) {
        throw new Error('Tool not found');
      }

      // Mark app as running
      const updatedTools = tools.map(t => 
        t.id === toolId 
          ? { ...t, execution: { ...t.execution, isRunning: true, error: null } } 
          : t
      );
      
      setTools(updatedTools);
      setFilteredTools(prev => 
        prev.map(t => 
          t.id === toolId 
            ? { ...t, execution: { ...t.execution, isRunning: true, error: null } } 
            : t
        )
      );
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      
      // Trigger terminal window opening for this toolId
      // We'll publish a custom event that the TerminalContext will listen for
      const terminalEvent = new CustomEvent('open-terminal', { detail: { toolId } });
      window.dispatchEvent(terminalEvent);
      
      // Actually execute the command
      try {
        await executeProcess(
          toolId,
          tool.execution.rootPath,
          tool.execution.command,
          tool.execution.environment.activationCommand
        );
        
        // Remove automatic URL opening
        // The port will be clickable in the UI instead
      } catch (execError) {
        console.error('Failed to execute process:', execError);
        
        // Update the tool with the error
        const erroredTools = tools.map(t => 
          t.id === toolId 
            ? { 
                ...t, 
                execution: { 
                  ...t.execution, 
                  isRunning: false, 
                  error: execError.message || 'Failed to run app' 
                } 
              } 
            : t
        );
        
        setTools(erroredTools);
        setFilteredTools(prev => 
          prev.map(t => 
            t.id === toolId 
              ? { 
                  ...t, 
                  execution: { 
                    ...t.execution, 
                    isRunning: false, 
                    error: execError.message || 'Failed to run app' 
                  } 
                } 
              : t
          )
        );
        
        // Update global cache
        globalToolsCache = erroredTools;
        
        await persistTools(erroredTools);
        
        throw execError;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to run app:', error);

      // Update tool with error
      const updatedTools = tools.map(tool => 
        tool.id === toolId 
          ? { 
              ...tool, 
              execution: { 
                ...tool.execution, 
                isRunning: false, 
                error: error.message || 'Failed to run app' 
              } 
            } 
          : tool
      );
      
      setTools(updatedTools);
      setFilteredTools(prev => 
        prev.map(tool => 
          tool.id === toolId 
            ? { 
                ...tool, 
                execution: { 
                  ...tool.execution, 
                  isRunning: false, 
                  error: error.message || 'Failed to run app' 
                } 
              } 
            : tool
        )
      );
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      return { 
        success: false, 
        error: error.message || 'Failed to run app' 
      };
    }
  };

  const stopApp = async (toolId) => {
    try {
      // Kill the process first
      await killProcess(toolId);
      
      const updatedTools = tools.map(tool => 
        tool.id === toolId 
          ? { ...tool, execution: { ...tool.execution, isRunning: false } } 
          : tool
      );
      
      setTools(updatedTools);
      setFilteredTools(prev => 
        prev.map(tool => 
          tool.id === toolId 
            ? { ...tool, execution: { ...tool.execution, isRunning: false } } 
            : tool
        )
      );
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      return { success: true };
    } catch (error) {
      console.error('Failed to stop app:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to stop app' 
      };
    }
  };

  const addApp = async (newApp) => {
    try {
      const newId = (Math.max(...tools.map(t => parseInt(t.id))) + 1).toString();
      const newAppWithId = { ...newApp, id: newId };
      const updatedTools = [...tools, newAppWithId];
      
      setTools(updatedTools);
      setFilteredTools(prev => [...prev, newAppWithId]);
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      return true;
    } catch (error) {
      console.error('Failed to add app:', error);
      return false;
    }
  };

  const updateApp = async (updatedApp) => {
    try {
      const updatedTools = tools.map(tool => 
        tool.id === updatedApp.id 
          ? { ...updatedApp } 
          : tool
      );
      
      setTools(updatedTools);
      setFilteredTools(prev => 
        prev.map(tool => 
          tool.id === updatedApp.id 
            ? { ...updatedApp } 
            : tool
        )
      );
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      return true;
    } catch (error) {
      console.error('Failed to update app:', error);
      return false;
    }
  };

  const deleteApp = async (appId) => {
    try {
      const updatedTools = tools.filter(tool => tool.id !== appId);
      
      setTools(updatedTools);
      setFilteredTools(prev => prev.filter(tool => tool.id !== appId));
      
      // Update global cache
      globalToolsCache = updatedTools;
      
      await persistTools(updatedTools);
      return true;
    } catch (error) {
      console.error('Failed to delete app:', error);
      return false;
    }
  };

  return (
    <ToolContext.Provider value={{ 
      tools, 
      filteredTools, 
      filterTools,
      runApp,
      stopApp,
      addApp,
      updateApp,
      deleteApp
    }}>
      {children}
    </ToolContext.Provider>
  );
} 