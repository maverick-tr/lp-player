import { motion, AnimatePresence } from 'framer-motion';
import { useTools } from '../../hooks/useTools';
import { useTheme } from '../../hooks/useTheme';
import { useNotification } from '../../hooks/useNotification';
import { useRef, useEffect, useState } from 'react';

function ToolCard({ tool, onEditClick }) {
  const { runApp, stopApp } = useTools();
  const { isDarkMode } = useTheme();
  const { showNotification } = useNotification();
  const isRunning = tool.execution.isRunning;
  const cardRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [runError, setRunError] = useState(null);
  const [buttonState, setButtonState] = useState(isRunning ? 'stop' : 'run');
  const [blobsVisible, setBlobsVisible] = useState(false);
  const [fillPercentage, setFillPercentage] = useState(0);

  const firstGlowColor = isRunning
    ? (isDarkMode ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.2)')
    : (isDarkMode ? 'rgba(188,204,15,0.15)' : 'rgba(188,204,15,0.12)');

  const secondGlowColor = isRunning
    ? (isDarkMode ? 'rgba(74,222,128,0.1)' : 'rgba(74,222,128,0.1)')
    : (isDarkMode ? 'rgba(188,204,15,0.05)' : 'rgba(188,204,15,0.06)');

  // Synchronize buttonState with app running state
  useEffect(() => {
    if (isRunning && !isStopping) {
      setButtonState('stop');
    } else if (!isRunning && !isStarting) {
      setButtonState('run');
      setBlobsVisible(false);
      setFillPercentage(0);
    }
  }, [isRunning, isStarting, isStopping]);

  useEffect(() => {
    // Reset state when the app stops running (but not during stopping animation)
    if (!isRunning && !isStopping) {
      setIsStarting(false);
      setBlobsVisible(false);
      setFillPercentage(0);
    }
  }, [isRunning, isStopping]);

  useEffect(() => {
    // If there's an error with the app, show notification
    if (tool.execution.error) {
      showNotification(
        `Error running ${tool.name}: ${tool.execution.error}`,
        'error'
      );
      setRunError(tool.execution.error);
      setIsStarting(false);
      setButtonState('run');
      setBlobsVisible(false);
      setFillPercentage(0);
    } else {
      setRunError(null);
    }
  }, [tool.execution.error, tool.name, showNotification]);

  // Handle filling animation
  useEffect(() => {
    let animationFrame;
    let startTime = null;
    let timeouts = [];
    
    // Filling animation
    if (isStarting && !isStopping) {
      // Show blobs at 0% fill
      setBlobsVisible(true);
      setFillPercentage(0);
      
      const duration = tool.port ? 2000 : 1200; // Animation duration in ms
      
      // Animate the fill smoothly using requestAnimationFrame
      const animateFill = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeOutQuad for smoother animation
        const eased = progress < 0.5 
          ? 2 * progress * progress 
          : -1 + (4 - 2 * progress) * progress;
          
        setFillPercentage(eased * 110); // Go to 110% to ensure complete fill
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animateFill);
        } else {
          // Animation completed, now start the app
          startApp();
          
          // Wait a moment and then switch to stop state
          timeouts.push(setTimeout(() => {
            setButtonState('stop');
            setIsStarting(false);
            
            // Success notification
            if (tool.port) {
              showNotification(`${tool.name} is running on port ${tool.port}`, 'success');
            }
            
            // Keep the yellow fill for a moment before hiding
            timeouts.push(setTimeout(() => {
              setBlobsVisible(false);
            }, 300));
          }, 200));
        }
      };
      
      animationFrame = requestAnimationFrame(animateFill);
      
      return () => {
        cancelAnimationFrame(animationFrame);
        timeouts.forEach(clearTimeout);
      };
    }
    
    // Draining animation
    else if (isStopping && !isStarting) {
      // Show blobs fully filled
      setBlobsVisible(true);
      setFillPercentage(100);
      
      const duration = 1000; // Drain animation duration
      
      // Animate the drain smoothly
      const animateDrain = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeInQuad for draining effect
        const eased = progress * progress;
        setFillPercentage(100 - (eased * 110)); // Start from 100% down to -10%
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animateDrain);
        } else {
          // Drain complete, now stop the app
          finishStopApp();
          
          // Hide blobs and reset state
          setBlobsVisible(false);
          setIsStopping(false);
          setButtonState('run');
        }
      };
      
      animationFrame = requestAnimationFrame(animateDrain);
      
      return () => {
        cancelAnimationFrame(animationFrame);
        timeouts.forEach(clearTimeout);
      };
    }
  }, [isStarting, isStopping, tool.port, tool.name, showNotification]);
  
  // Helper function to start the app and handle errors
  const startApp = async () => {
    const result = await runApp(tool.id);
    if (!result.success) {
      setIsStarting(false);
      setButtonState('run');
      setBlobsVisible(false);
      setFillPercentage(0);
      showNotification(`Failed to start ${tool.name}: ${result.error}`, 'error');
    }
  };
  
  // Helper function to stop the app and handle errors
  const finishStopApp = async () => {
    const result = await stopApp(tool.id);
    if (!result.success) {
      setIsStopping(false);
      setButtonState('stop');
      showNotification(`Failed to stop ${tool.name}: ${result.error}`, 'error');
    }
  };

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleAction = async () => {
    if (isStarting || isStopping) return; // Prevent actions while animating
    
    if (isRunning) {
      // Start the stopping animation
      setIsStopping(true);
      setButtonState('draining');
      // Actual stopApp call is handled in the useEffect after animation
    } else {
      // Start the animation first
      setIsStarting(true);
      setButtonState('starting');
      // Actual runApp call is handled in the useEffect after animation
    }
  };

  // Get the appropriate button style based on current state
  const getButtonStyle = () => {
    if (buttonState === 'stop') {
      return isDarkMode
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-red-500 text-white hover:bg-red-600';
    } else if (buttonState === 'starting' || buttonState === 'draining') {
      return isDarkMode
        ? 'border border-[#bccc0f] text-[#bccc0f] bg-transparent'
        : 'border border-black text-black bg-transparent';
    } else { // 'run' state
      return isDarkMode
        ? 'border border-[#bccc0f] text-[#bccc0f] bg-transparent hover:bg-[#bccc0f]/10'
        : 'border border-black text-black bg-transparent hover:bg-[#bccc0f]/10';
    }
  };
  
  // Get the button text based on current state
  const getButtonText = () => {
    switch (buttonState) {
      case 'stop': return 'Stop';
      case 'starting': return 'Starting...';
      case 'draining': return 'Stopping...';
      default: return 'Run';
    }
  };

  return (
    <motion.div 
      ref={cardRef}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative p-5 rounded-xl border transition-all duration-300
        h-[260px] flex flex-col justify-between overflow-hidden
        ${isDarkMode
          ? isRunning 
            ? 'border-green-300 bg-gradient-to-br from-green-300/10 to-transparent' 
            : 'border-tool-border bg-tool-light'
          : isRunning
            ? 'border-green-200 bg-gradient-to-br from-green-50 to-white' 
            : 'border-black bg-white'
        }
      `}
      style={{
        '--card-bg': isDarkMode ? 'rgba(188,204,15,0.03)' : 'rgba(188,204,15,0.015)'
      }}
    >
      {/* SVG Filter for Gooey Effect */}
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ display: 'none' }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Edit button in top right corner */}
      <motion.button
        className={`absolute top-2 right-2 p-1 rounded-full
          ${isDarkMode 
            ? 'bg-[#bccc0f]/20 hover:bg-[#bccc0f]/30 text-[#bccc0f]' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          } z-20`}
        onClick={(e) => {
          e.stopPropagation();
          onEditClick(tool);
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </motion.button>

      {/* Updated Glow Effect Layer */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          backgroundImage: `radial-gradient(
            600px circle at ${mousePosition.x}px ${mousePosition.y}px,
            ${firstGlowColor} 0%,
            ${secondGlowColor} 20%,
            transparent 50%
          )`,
          mixBlendMode: isDarkMode ? 'screen' : 'multiply'
        }}
      />

      {/* Card Content */}
      <div className="relative z-10 will-change-transform">
        <div className="flex flex-col items-center h-[130px]">
          <motion.img 
            layout="position"
            src={tool.logoPath} 
            alt={tool.name}
            className="w-12 h-12 object-contain mb-1"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          />
          <h3
            className={`text-lg font-semibold leading-tight mb-1 ${
              isDarkMode ? 'text-white' : 'text-tool-light-mode-text'
            }`}
          >
            {tool.name}
          </h3>
          <p
            className={`text-sm text-center line-clamp-2 px-1 leading-snug ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {tool.description}
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center min-h-[44px] mt-2 mb-4">
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className="truncate max-w-full mb-1">
              <span className="font-semibold">Path:</span> {tool.execution.rootPath}
            </p>
            <p className="truncate max-w-full">
              <span className="font-semibold">Command:</span> {tool.execution.command}
              {tool.port && (
                <span className="ml-1 px-1 py-0.5 bg-gray-700/30 rounded text-[10px] whitespace-nowrap">
                  Port: {tool.port}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="h-[36px] relative overflow-hidden rounded-lg mx-2 mb-2">
          {/* The button container */}
          <motion.button
            layout="position"
            whileHover={{ 
              scale: 1.005,
              boxShadow: 'none'
            }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAction}
            disabled={isStarting || isStopping}
            className={`
              w-full h-full px-4 rounded-lg relative
              transition-all duration-200 overflow-hidden
              ${getButtonStyle()}
              ${(isStarting || isStopping) ? 'cursor-wait' : ''}
            `}
          >
            {/* Button text */}
            <span className="relative z-10">{getButtonText()}</span>

            {/* Yellow fill animation */}
            {blobsVisible && (
              <div 
                className="absolute inset-0 overflow-hidden z-[1] rounded-lg bg-[#bccc0f] transition-opacity duration-300"
                style={{
                  clipPath: `polygon(
                    0 100%, 
                    0 ${100 - fillPercentage}%, 
                    100% ${100 - fillPercentage}%, 
                    100% 100%
                  )`,
                  opacity: buttonState === 'stop' ? 0 : 1
                }}
              />
            )}
          </motion.button>
        </div>

        {/* Error message under button */}
        <AnimatePresence>
          {runError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1"
            >
              <p className="text-xs text-red-500 truncate">{runError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default ToolCard; 