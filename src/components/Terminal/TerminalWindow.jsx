import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { useTools } from '../../hooks/useTools';
import { useTerminal } from '../../hooks/useTerminal';

// Smoke effect styles
const smokeStyles = `
  .smoke {
    position: absolute;
    background-size: contain;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 999;
    will-change: transform, opacity;
    transform-origin: center bottom;
    opacity: 0;
  }

  .smoke-1 { background-image: url('https://res.cloudinary.com/da51wkm4r/image/upload/v1461143297/title/smoke.png'); }
  .smoke-2 { background-image: url('https://res.cloudinary.com/daqwsgmx6/image/upload/v1718841063/smoke2_rhuxhw.png'); }
  .smoke-3 { background-image: url('https://res.cloudinary.com/daqwsgmx6/image/upload/v1718841063/smoke3_buxe4f.png'); }
  .smoke-4 { background-image: url('https://res.cloudinary.com/daqwsgmx6/image/upload/v1718841063/smoke4_dphicc.png'); }

  @keyframes smokeRise {
    0% { 
      opacity: 0.05; 
      transform: translateY(0) scale(1) rotate(0deg);
    }
    20% { 
      opacity: 0.5; 
    }
    60% { 
      opacity: 0.3; 
    }
    100% { 
      opacity: 0; 
      transform: translateY(-100px) scale(1.8) rotate(var(--rotation));
    }
  }

  .smokeAnimation {
    animation-name: smokeRise;
    animation-timing-function: ease-out;
    animation-fill-mode: forwards;
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
  const [portReadyMsg, setPortReadyMsg] = useState(null);
  
  // Sync local state with context state
  useEffect(() => {
    setIsMinimized(isTerminalMinimized);
  }, [isTerminalMinimized]);
  
  // Listen for port-ready events to show "Ready" in minimized view
  useEffect(() => {
    const handler = (e) => {
      const { toolName: name, port } = e.detail;
      setPortReadyMsg(`${name} ready on :${port}`);
      const timer = setTimeout(() => setPortReadyMsg(null), 5000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('port-ready', handler);
    return () => window.removeEventListener('port-ready', handler);
  }, []);

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
    // Log currently active tools for debugging
    console.log('Active tools updated:', activeTools.map(t => t.name));
    console.log('Current active tab:', activeToolTab);
    
    // If the current tool exists and is running, keep it selected
    if (toolName && activeTools.some(tool => tool.name === toolName)) {
      console.log(`Current tool ${toolName} is active, keeping as selected tab`);
      setActiveToolTab(toolName);
    } 
    // If there are running tools but current tab is not running or not set, select first running tool
    else if (activeTools.length > 0 && (!activeToolTab || !activeTools.some(tool => tool.name === activeToolTab))) {
      const newActiveTab = activeTools[0].name;
      console.log(`Setting active tab to first running tool: ${newActiveTab}`);
      setActiveToolTab(newActiveTab);
    }
    // If no running tools, keep current tab for reference if it exists (might be stopping)
    else if (activeTools.length === 0 && activeToolTab) {
      console.log(`No running tools, keeping last tab ${activeToolTab} visible for reference`);
      // Don't change the tab, keep showing the last active tool output
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

    // Start smoke effect when countdown reaches 2
    if (autoCloseCountdown === 2) {
      console.log('Starting smoke effect at countdown 2');
      createSmokeEffect();
    }

    // Close immediately when countdown reaches 0
    if (autoCloseCountdown <= 0) {
      console.log('Countdown reached 0, closing immediately');
      onClose();
      return;
    }

    // Decrement every second
    const timer = setTimeout(() => {
      setAutoCloseCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoCloseCountdown, onClose]);

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
      // Increase smoke count for more visibility
      const smokeCount = isMinimized ? 40 : 32;

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

      // Create smoke elements in staggered fashion
      const createSmokeParticle = (index) => {
        if (viewportRef.current) {
          const smoke = document.createElement('div');
          // Randomly select a smoke image variant (1-4)
          const smokeVariant = Math.floor(Math.random() * 4) + 1;
          smoke.className = `smoke smoke-${smokeVariant}`;
          // Calculate particle position - more concentrated along terminal edges and bottom
          let posX, posY;
          const edgeProbability = 0.7;
          if (Math.random() < edgeProbability) {
            if (Math.random() < 0.5) {
              posX = Math.random() < 0.5 ? 
                terminalRect.left - 20 + Math.random() * 40 : 
                terminalRect.right - 40 + Math.random() * 40;
              posY = terminalRect.top + Math.random() * terminalRect.height;
            } else {
              posX = terminalRect.left + Math.random() * terminalRect.width;
              posY = Math.random() < 0.7 ? 
                terminalRect.bottom - 30 + Math.random() * 20 : 
                terminalRect.top - 20 + Math.random() * 40;
            }
          } else {
            posX = terminalRect.left - 40 + Math.random() * (terminalRect.width + 80);
            posY = terminalRect.top - 30 + Math.random() * (terminalRect.height + 60);
          }
          smoke.style.left = `${posX}px`;
          smoke.style.top = `${posY}px`;
          // Randomize size based on position
          const baseSize = isMinimized ? 110 : 140;
          const sizeVariation = isMinimized ? 70 : 90;
          const size = baseSize + Math.random() * sizeVariation;
          smoke.style.width = `${size}px`;
          smoke.style.height = `${size}px`;
          // Set custom animation properties
          const animationDuration = 1800 + Math.random() * 900;
          const rotation = -20 + Math.random() * 40;
          smoke.style.setProperty('--rotation', `${rotation}deg`);
          smoke.style.animation = `smokeRise ${animationDuration}ms ease-out forwards`;
          smoke.style.filter = `blur(${1 + Math.random() * 2}px)`;
          // Make smoke more visible
          smoke.style.opacity = `${0.18 + Math.random() * 0.22}`;
          viewportRef.current.appendChild(smoke);
          setTimeout(() => {
            if (smoke && viewportRef.current && viewportRef.current.contains(smoke)) {
              viewportRef.current.removeChild(smoke);
            }
            if (viewportRef.current && viewportRef.current.childNodes.length === 0) {
              document.body.removeChild(viewportRef.current);
              viewportRef.current = null;
            }
          }, animationDuration + 100);
        }
      };
      for (let i = 0; i < smokeCount; i++) {
        setTimeout(() => createSmokeParticle(i), i * 30);
      }
    }
  };

  // Custom close handler to trigger smoke effect before closing
  const handleClose = () => {
    console.log('Handle close clicked');
    
    // Create smoke effect first
    createSmokeEffect();
    
    // Then close the terminal after a delay to allow smoke to be seen
    setTimeout(() => {
      console.log('Calling onClose from TerminalWindow');
      onClose();
    }, 1200);
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
      <AnimatePresence mode="wait" onExitComplete={() => console.log('Terminal exit animation complete')}>
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

                {/* Port ready indicator in minimized view */}
                {isMinimized && portReadyMsg && (
                  <div className={`ml-3 text-xs font-bold flex-shrink-0 ${isDarkMode ? 'text-[#bccc0f]' : 'text-[#4a5a06]'}`}>
                    {portReadyMsg}
                  </div>
                )}

                {/* Show output summary - in different styles based on minimized state */}
                {activeTools.length > 0 && !portReadyMsg && (
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