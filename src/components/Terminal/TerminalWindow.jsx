import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { useTools } from '../../hooks/useTools';

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
    animation: smokeAppearFade 3s ease-out forwards;
  }
`;

const TerminalWindow = ({ isOpen, output, toolName, onClose, isConnected }) => {
  const { isDarkMode } = useTheme();
  const { tools } = useTools();
  const terminalRef = useRef(null);
  const terminaElRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const wasRunningRef = useRef(false);
  const intervalRef = useRef(null);
  const viewportRef = useRef(null);

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

  // Smoke effect function
  const createSmokeEffect = () => {
    if (terminaElRef.current) {
      const terminalRect = terminaElRef.current.getBoundingClientRect();
      const smokeCount = 15;

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

      // Create all smoke elements at once
      for (let i = 0; i < smokeCount; i++) {
        if (viewportRef.current) {
          const smoke = document.createElement('div');
          smoke.className = 'smoke smokeAnimation';
          
          // Position the smoke based on the terminal position
          smoke.style.left = `${terminalRect.left + Math.random() * terminalRect.width}px`;
          smoke.style.top = `${terminalRect.top + Math.random() * 50}px`;
          
          // Randomize size
          const size = 40 + Math.random() * 100;
          smoke.style.width = `${size}px`;
          smoke.style.height = `${size}px`;
          
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
          }, 3000);
        }
      }
    }
  };

  // Custom close handler to trigger smoke effect before closing
  const handleClose = () => {
    if (isClosing) return;
    
    setIsClosing(true);
    createSmokeEffect();
    
    // Delay the actual close to allow smoke animation to start
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 500);
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
            initial={{ y: -100, opacity: 0 }}
            animate={{ 
              y: 0, 
              height: isMinimized ? '36px' : '140px',
              opacity: 1 
            }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 180 }}
            className={`fixed top-[140px] left-0 right-0 z-40 mx-auto max-w-3xl 
                     ${isDarkMode ? 'bg-tool-dark' : 'bg-gray-100'}
                     border border-[#bccc0f] rounded-xl shadow-xl overflow-hidden
                     mb-0`}
          >
            {/* Terminal header */}
            <div 
              className={`flex justify-between items-center px-4 py-1.5
                      ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-200'} 
                      border-b border-[#bccc0f]/50 cursor-pointer
                      rounded-t-xl`}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <h3 className={`font-mono text-sm ${isDarkMode ? 'text-[#bccc0f]' : 'text-gray-800'}`}>
                  {toolName ? `${toolName} - Process Output` : 'Terminal Output'}
                </h3>
                {/* Connection status indicator */}
                <div className="ml-2 flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {autoCloseCountdown !== null && (
                  <div className="ml-2 text-xs text-yellow-500 font-bold">
                    Auto-closing in {autoCloseCountdown}s...
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className={`p-1 rounded hover:bg-opacity-80 text-xs
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
                  className={`p-1 rounded hover:bg-opacity-80 text-xs
                           ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-300 text-gray-600'}`}
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Terminal content */}
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TerminalWindow; 