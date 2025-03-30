import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { useTools } from '../../hooks/useTools';
import { useTerminal } from '../../hooks/useTerminal';

// Smoke effect styles
const smokeStyles = `
  .smoke {
    position: absolute;
    width: 250px;
    height: 250px;
    background: url('https://res.cloudinary.com/da51wkm4r/image/upload/v1461143297/title/smoke.png') no-repeat;
    background-size: contain;
    opacity: 0;
    pointer-events: none;
    z-index: 999;
  }

  @keyframes smokeAppearFade {
    0% { opacity: 0; }
    10% { opacity: 0.4; }
    100% { opacity: 0; }
  }

  .smokeAnimation {
    animation: smokeAppearFade 4s ease-out forwards;
  }
`;

const TerminalWindow = ({ isOpen, output, toolName, onClose, isConnected }) => {
  const { isDarkMode } = useTheme();
  const { tools } = useTools();
  const { toggleTerminalSize, isTerminalMinimized, openTerminalForTool } = useTerminal();
  const terminalRef = useRef(null);
  const terminaElRef = useRef(null);
  // Use the context's state for minimized
  const [isMinimized, setIsMinimized] = useState(isTerminalMinimized);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const wasRunningRef = useRef(false);
  const intervalRef = useRef(null);
  const viewportRef = useRef(null);
  
  // Sync local state with context state
  useEffect(() => {
    setIsMinimized(isTerminalMinimized);
  }, [isTerminalMinimized]);
  
  // Get active tools (running processes)
  const activeTools = tools.filter(tool => tool.execution.isRunning);
  const [activeToolTab, setActiveToolTab] = useState(toolName);

  // Update active tool tab when toolName prop changes
  useEffect(() => {
    if (toolName) {
      setActiveToolTab(toolName);
    }
  }, [toolName]);

  // Handle tab change
  const handleTabChange = (selectedToolName) => {
    // Don't do anything if already on this tab
    if (selectedToolName === activeToolTab) return;
    
    setActiveToolTab(selectedToolName);
    
    // Find the tool by name to get its ID
    const selectedTool = tools.find(tool => tool.name === selectedToolName);
    if (selectedTool) {
      console.log(`Switching terminal to tool: ${selectedToolName}`);
      // Pass true to preserve the current minimized/maximized state
      openTerminalForTool(selectedTool.id, true);
    }
  };

  // Set active tool tab when a new tool starts
  useEffect(() => {
    if (toolName && activeTools.some(tool => tool.name === toolName)) {
      setActiveToolTab(toolName);
    } else if (activeTools.length > 0 && (!activeToolTab || !activeTools.some(tool => tool.name === activeToolTab))) {
      setActiveToolTab(activeTools[0].name);
    }
  }, [toolName, activeTools, activeToolTab]);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current && !isMinimized) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, isMinimized]);
  
  // Check if any tool is running
  const isAnyToolRunning = tools.some(tool => tool.execution.isRunning);
  
  // Set up a recurring check for app state
  useEffect(() => {
    // Set up interval to check state every 500ms
    intervalRef.current = setInterval(() => {
      const isRunning = tools.some(tool => tool.execution.isRunning);
      
      // App was running before, but now stopped
      if (wasRunningRef.current && !isRunning && isOpen && output.length > 0) {
        console.log('App stopped detected in interval');
        wasRunningRef.current = false;
        
        // Start countdown if not already started
        if (autoCloseCountdown === null) {
          setAutoCloseCountdown(5);
        }
      } 
      // App is running
      else if (isRunning) {
        wasRunningRef.current = true;
        setAutoCloseCountdown(null);
      }
    }, 500);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, output.length, tools, autoCloseCountdown]);
  
  // Also check on direct state changes to catch immediate transitions
  useEffect(() => {
    // If terminal not open, don't do anything
    if (!isOpen) return;
    
    // App is running
    if (isAnyToolRunning) {
      console.log('App is running, updating ref');
      wasRunningRef.current = true;
      setAutoCloseCountdown(null);
    } 
    // App stopped and has output - possibly start countdown
    else if (!isAnyToolRunning && wasRunningRef.current && output.length > 0) {
      console.log('App stopped running, may start countdown');
      wasRunningRef.current = false;
      
      if (autoCloseCountdown === null) {
        setAutoCloseCountdown(5);
      }
    }
  }, [isOpen, isAnyToolRunning, output.length, autoCloseCountdown]);
  
  // Handle the actual countdown timer
  useEffect(() => {
    if (autoCloseCountdown === null) return;
    
    console.log(`Countdown: ${autoCloseCountdown}`);
    
    // Close when countdown reaches 0
    if (autoCloseCountdown <= 0) {
      console.log('Closing terminal');
      handleClose();
      return;
    }
    
    // Decrement every second
    const timer = setTimeout(() => {
      setAutoCloseCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [autoCloseCountdown]);

  // Get the latest output line for summary
  const getOutputSummary = () => {
    if (output.length === 0) return "Waiting for process output...";
    
    // Get the last non-empty line
    for (let i = output.length - 1; i >= 0; i--) {
      // Remove HTML tags and normalize special characters
      const line = output[i]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\u001b\[\d+m/g, '') // Remove ANSI color codes
        .replace(/\s+/g, ' '); // Normalize whitespace
      
      if (line.trim()) {
        // No need for explicit truncation as CSS handles it
        return line.trim();
      }
    }
    
    return output[output.length - 1].replace(/<[^>]*>/g, '').trim() || "Process running...";
  };

  // Smoke effect function
  const createSmokeEffect = () => {
    if (terminaElRef.current) {
      const terminalRect = terminaElRef.current.getBoundingClientRect();
      const smokeCount = isMinimized ? 20 : 15;

      // Create a viewport for smoke if it doesn't exist
      if (!viewportRef.current) {
        const viewport = document.createElement('div');
        viewport.style.position = 'fixed';
        viewport.style.top = '0';
        viewport.style.left = '0';
        viewport.style.width = '100%';
        viewport.style.height = '100%';
        viewport.style.pointerEvents = 'none';
        viewport.style.zIndex = '9999';
        viewport.id = 'smoke-viewport';
        document.body.appendChild(viewport);
        viewportRef.current = viewport;
      }

      // Get the vertical spread area - for minimized state, spread wider
      const verticalSpread = isMinimized ? 100 : 50;
      
      // Create all smoke elements at once
      for (let i = 0; i < smokeCount; i++) {
        if (viewportRef.current) {
          const smoke = document.createElement('div');
          smoke.className = 'smoke smokeAnimation';
          
          // Position the smoke - for minimized view, distribute more widely
          smoke.style.left = `${terminalRect.left - 50 + Math.random() * (terminalRect.width + 100)}px`;
          smoke.style.top = `${terminalRect.top - 20 + Math.random() * verticalSpread}px`;
          
          // Randomize size - larger for minimized view for better visibility
          const minSize = isMinimized ? 30 : 40;
          const maxSize = isMinimized ? 90 : 100;
          const size = minSize + Math.random() * (maxSize - minSize);
          smoke.style.width = `${size}px`;
          smoke.style.height = `${size}px`;
          
          // For minimized view, increase initial opacity for better visibility
          if (isMinimized) {
            smoke.style.opacity = '0.15';  // This will be modified by the animation
          }
          
          viewportRef.current.appendChild(smoke);
          
          // Remove smoke element after animation
          setTimeout(() => {
            if (smoke && viewportRef.current && viewportRef.current.contains(smoke)) {
              viewportRef.current.removeChild(smoke);
            }
            
            // Remove viewport if no smoke elements left
            if (viewportRef.current && viewportRef.current.childNodes.length === 0) {
              document.body.removeChild(viewportRef.current);
              viewportRef.current = null;
            }
          }, 4000); // Use same duration for both minimized and maximized
        }
      }
    }
  };

  // Custom close handler to trigger smoke effect before closing
  const handleClose = () => {
    if (isClosing) return;
    
    setIsClosing(true);
    createSmokeEffect();
    
    // Delay the actual close to allow smoke animation to run for 1 second before closing
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 1000);
  };

  // Handle expanding/minimizing the terminal
  const handleToggleMinimize = (shouldMinimize) => {
    setIsMinimized(shouldMinimize);
    toggleTerminalSize(shouldMinimize);
  };

  // Add the smoke styles to the document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = smokeStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
      // Clean up smoke viewport if component unmounts
      if (viewportRef.current) {
        document.body.removeChild(viewportRef.current);
        viewportRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <AnimatePresence onExitComplete={() => console.log('Exit animation complete')}>
        {isOpen && (
          <motion.div
            ref={terminaElRef}
            initial={{ y: -50, opacity: 0 }}
            animate={{ 
              y: 0, 
              height: isMinimized ? '36px' : '140px',
              opacity: 1 
            }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 180 }}
            className={`fixed top-[140px] left-4 right-4 sm:left-8 sm:right-8 z-40 mx-auto max-w-3xl 
                     ${isDarkMode ? 'bg-tool-dark' : 'bg-gray-100'}
                     border border-[#bccc0f] shadow-xl overflow-hidden
                     flex flex-col
                     ${isMinimized ? 'rounded-xl' : 'rounded-xl'}`}
          >
            {/* Terminal header/tabbed view*/}
            <div 
              className={`flex justify-between items-center px-4 ${isMinimized ? 'h-full' : 'py-2.5'}
                      ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-200'} 
                      border-b ${!isMinimized ? 'border-[#bccc0f]/50' : 'border-transparent'} cursor-pointer
                      rounded-t-xl ${isMinimized ? 'rounded-b-xl' : ''}`}
            >
              {/* Left side: Name and tabs */}
              <div className="flex items-center gap-1.5 overflow-hidden flex-grow max-w-[calc(100%-85px)]">
                {/* Show tabs whenever multiple tools are running (both minimized and maximized) */}
                {activeTools.length > 0 ? (
                  <div className="flex space-x-1 flex-shrink-0">
                    {activeTools.map(tool => (
                      <div 
                        key={tool.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTabChange(tool.name);
                        }}
                        className={`px-3 ${isMinimized ? 'py-0.5' : 'py-1.5'} text-xs rounded-t-md cursor-pointer transition-colors
                                  ${activeToolTab === tool.name 
                                    ? isDarkMode 
                                      ? 'bg-black text-[#bccc0f]' 
                                      : 'bg-white text-gray-800'
                                    : isDarkMode
                                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                      : 'bg-gray-300 text-gray-600 hover:bg-gray-200'
                                  }`}
                      >
                        {tool.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <h3 className={`font-mono text-sm flex-shrink-0 ${isDarkMode ? 'text-[#bccc0f]' : 'text-gray-800'}`}>
                    {toolName ? `${toolName} - Process Output` : 'Terminal Output'}
                  </h3>
                )}

                {/* Connection status indicator */}
                <div className="ml-3 flex items-center flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                {autoCloseCountdown !== null && (
                  <div className="ml-3 text-xs text-yellow-500 font-bold flex-shrink-0">
                    Auto-closing in {autoCloseCountdown}s...
                  </div>
                )}

                {/* Show output summary - in different styles based on minimized state */}
                {activeTools.length > 0 && (
                  <div 
                    className={`ml-3 text-xs flex-shrink-0 ${isMinimized ? 'overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0' : ''} 
                              ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}
                  >
                    {isMinimized ? getOutputSummary() : ''}
                  </div>
                )}
              </div>

              {/* Right side controls */}
              <div className="flex gap-2.5 ml-2 flex-shrink-0 w-[75px] justify-end">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMinimized) {
                      handleToggleMinimize(false);
                    } else {
                      handleToggleMinimize(true);
                    }
                  }}
                  className={`${isMinimized ? 'p-1' : 'p-1.5'} rounded hover:bg-opacity-80 text-xs
                           ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-300 text-gray-600'}`}
                  title={isMinimized ? "Expand" : "Collapse"}
                >
                  {isMinimized ? '▽' : '△'}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className={`${isMinimized ? 'p-1' : 'p-1.5'} rounded hover:bg-opacity-80 text-xs
                           ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-300 text-gray-600'}`}
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Terminal content - only show when maximized */}
            {!isMinimized && (
              <div 
                ref={terminalRef}
                className={`h-full overflow-auto font-mono text-xs p-2.5 whitespace-pre-wrap
                         ${isDarkMode ? 'bg-black text-green-300' : 'bg-gray-900 text-green-400'}
                         rounded-b-xl`}
              >
                {!isConnected && (
                  <div className="text-red-400 mb-2 p-1 border border-red-400 rounded bg-red-900 bg-opacity-30">
                    ⚠️ WebSocket disconnected. Attempting to reconnect...
                  </div>
                )}
                
                {/* Status indicator for active tool */}
                {activeToolTab && activeTools.length > 0 && (
                  <div className={`mb-2 p-1 border border-gray-600 rounded bg-opacity-30 bg-gray-800 text-xs`}>
                    <span className="text-green-400">▸</span> Currently showing output for <span className="text-[#bccc0f] font-bold">{activeToolTab}</span> - Latest: {getOutputSummary()}
                  </div>
                )}
                
                {output.length > 0 ? (
                  output.map((line, index) => (
                    <div key={index} 
                        className="mb-1"
                        dangerouslySetInnerHTML={{
                          __html: line.includes('<span') 
                            ? line 
                            : line.includes('Error:') 
                              ? `<span class="text-red-400">${line}</span>` 
                              : (line.startsWith('$') 
                                  ? `<span class="text-[#bccc0f]">${line}</span>` 
                                  : `<span class="text-[#bccc0f] mr-2">$</span>${line}`)
                        }} 
                    />
                  ))
                ) : (
                  <div className="text-gray-500 italic">Waiting for process output...</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TerminalWindow; 