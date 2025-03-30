import { motion, AnimatePresence } from 'framer-motion';
import { useTools } from '../../hooks/useTools';
import { useTheme } from '../../hooks/useTheme';
import { useNotification } from '../../hooks/useNotification';
import { useRef, useEffect, useState } from 'react';

function ToolCard({ tool, onEditClick, onDeleteClick }) {
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
  const [rotation, setRotation] = useState(0);

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
            // Note: We now change the button to "Starting..." but not to "Stop" yet
            // The actual "Stop" state will be triggered by the tool context
            // when it detects the app is truly ready
            setButtonState('waiting');
            setIsStarting(false);
            
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
  
  // Rotation animation for vinyl record when running
  useEffect(() => {
    let animationId;
    
    if (isRunning) {
      const animate = () => {
        setRotation(prev => (prev + 0.2) % 360);
        animationId = requestAnimationFrame(animate);
      };
      
      animationId = requestAnimationFrame(animate);
    } else {
      // Gradually slow down rotation when stopping
      const slowDown = () => {
        setRotation(prev => {
          const newRotation = prev + 0.1;
          if (newRotation > 360) {
            return 0;
          }
          return newRotation;
        });
        
        if (rotation > 0) {
          animationId = requestAnimationFrame(slowDown);
        }
      };
      
      if (rotation > 0) {
        animationId = requestAnimationFrame(slowDown);
      }
    }
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRunning, rotation]);
  
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
        ? 'bg-transparent' 
        : 'bg-transparent';
    } else if (buttonState === 'starting' || buttonState === 'draining' || buttonState === 'waiting') {
      return isDarkMode
        ? 'bg-transparent opacity-75' 
        : 'bg-transparent opacity-75';
    } else {
      return isDarkMode
        ? 'bg-transparent' 
        : 'bg-transparent';
    }
  };

  // Get the button content based on current state
  const getButtonContent = () => {    
    return (
      <div className="relative flex items-center w-full justify-center">
        {/* Control panel with vinyl disc */}
        <div className="h-8 w-[68px] relative flex-shrink-0">
          {/* Dark control panel background */}
          <div className={`absolute inset-0 rounded-md border overflow-hidden ${
            isDarkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-[#e0e0e0] border-[#ccc]'
          }`}>
            {/* Subtle panel texture */}
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 2px,
                    ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 4px
                  )
                `
              }}
            ></div>
            
            {/* Status LED dot */}
            <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`absolute inset-0 rounded-full transition-all duration-300
                  ${isRunning 
                    ? 'bg-[#bccc0f] opacity-100 shadow-[0_0_5px_rgba(188,204,15,0.7)]' 
                    : 'bg-neutral-600 opacity-60'
                  }
                `}
              ></div>
            </div>
            
            {/* ON/OFF text */}
            <div className="absolute top-2 right-2 text-[7px] font-bold font-mono">
              <span className={`${isRunning ? 'text-[#bccc0f]' : isDarkMode ? 'text-[#bccc0f]' : 'text-[#666]'}`}>
                {isRunning ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
          
          {/* Vinyl disc */}
          <motion.div 
            className={`absolute top-1/2 left-[8px] -translate-y-1/2 w-6 h-6 z-10`}
            animate={{ 
              x: isRunning ? 22 : 0
            }}
            transition={{
              x: { 
                type: "spring", 
                stiffness: 300, 
                damping: 25
              }
            }}
          >
            {/* Vinyl disc with grooves */}
            <motion.div 
              className={`absolute inset-0 rounded-full overflow-hidden shadow-md ${
                isDarkMode ? 'bg-[#222]' : 'bg-[#555]'
              }`}
              animate={{ 
                rotate: isRunning ? 360 : 0
              }}
              transition={{
                rotate: {
                  duration: isRunning ? 3 : 0.5,
                  ease: isRunning ? "linear" : "easeOut",
                  repeat: isRunning ? Infinity : 0,
                  repeatType: "loop"
                }
              }}
              style={{
                width: '24px',
                height: '24px',
                transform: `scale(1) ${isRunning ? 'rotate(360deg)' : 'rotate(0deg)'}`,
                transformOrigin: 'center center'
              }}
            >
              {/* Grooves */}
              <div 
                className="absolute inset-0 rounded-full opacity-80"
                style={{
                  backgroundImage: `
                    repeating-radial-gradient(
                      circle at center,
                      ${isDarkMode ? '#222' : '#555'} 0px,
                      ${isDarkMode ? '#222' : '#555'} 1px,
                      ${isDarkMode ? '#333' : '#777'} 1px,
                      ${isDarkMode ? '#333' : '#777'} 2px
                    )
                  `
                }}
              ></div>
              
              {/* Center hole */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '24px',
                height: '24px',
                marginLeft: '-12px',
                marginTop: '-12px',
                background: 'black',
                border: '2px solid #444',
                borderRadius: '50%',
                transform: 'scale(1)',
                transformOrigin: 'center center'
              }}></div>
              
              {/* Label */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  background: isRunning 
                    ? 'radial-gradient(circle at 30% 30%, #bccc0f, #9aa50a)' 
                    : 'radial-gradient(circle at 30% 30%, #999, #666)',
                  boxShadow: isRunning ? '0 0 5px rgba(188,204,15,0.7)' : 'none'
                }}
              >
                {/* Label detail */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  <div 
                    className={`w-1 h-[1px] ${isRunning ? 'bg-yellow-200' : 'bg-gray-300'} opacity-80`}
                    style={{ transform: 'rotate(45deg)' }}
                  ></div>
                  <div 
                    className={`w-1 h-[1px] ${isRunning ? 'bg-yellow-200' : 'bg-gray-300'} opacity-80`} 
                    style={{ transform: 'rotate(-45deg)' }}
                  ></div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Status text (only shown during transitions) */}
        {(buttonState === 'starting' || buttonState === 'draining' || buttonState === 'waiting') && (
          <div className="absolute right-4 flex items-center">
            <motion.span 
              className={`text-sm font-medium ${
                isDarkMode 
                  ? 'text-[#bccc0f]'
                  : 'text-gray-700'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {buttonState === 'draining' ? 'Stopping...' : 'Starting...'}
            </motion.span>
          </div>
        )}
      </div>
    );
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
        relative p-4 transition-all duration-300
        h-[260px] w-[100%] flex flex-col justify-between overflow-hidden
        rounded-lg ${isRunning ? 'border' : 'border-2'}
        ${isDarkMode
          ? isRunning 
            ? 'border-[#bccc0f]/80 bg-black' 
            : 'border-[#bccc0f]/20 bg-neutral-900'
          : isRunning
            ? 'border-[#bccc0f]/80 bg-gray-50' 
            : 'border-[#bccc0f]/40 bg-white'
        }
      `}
      style={{
        '--card-bg': isDarkMode ? 'rgba(188,204,15,0.03)' : 'rgba(188,204,15,0.015)',
        boxShadow: isRunning 
          ? `0 0 15px ${isDarkMode ? 'rgba(188,204,15,0.3)' : 'rgba(188,204,15,0.5)'}` 
          : `0 0 10px ${isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)'}`,
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

      {/* Record sleeve background with subtle texture */}
      <div className="absolute inset-0 rounded-lg overflow-hidden z-0">
        <div className="absolute inset-0 rounded-lg" style={{
          backgroundImage: isDarkMode 
            ? `linear-gradient(to bottom, 
                rgba(30, 30, 30, 0.7), 
                rgba(10, 10, 10, 0.9)
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 2px,
                rgba(50, 50, 50, 0.1) 2px,
                rgba(50, 50, 50, 0.1) 4px
              )`
            : `linear-gradient(to bottom, 
                rgba(250, 250, 250, 0.8), 
                rgba(230, 230, 230, 0.9)
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 2px,
                rgba(200, 200, 200, 0.2) 2px,
                rgba(200, 200, 200, 0.2) 4px
              )`,
          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
          borderBottom: `1px solid ${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
        }}></div>
      </div>

      {/* Vinyl record peeking out from top of sleeve */}
        <motion.div 
        className="absolute top-0 inset-x-0 h-24 overflow-visible z-20 pointer-events-none filter-exempt"
        animate={{
          y: isRunning ? -180 : 0,
          opacity: isRunning ? 0 : 1
        }}
        transition={{
          y: { 
            duration: 2.5, 
            ease: "easeInOut" 
          },
          opacity: { 
            duration: 0.8, 
            delay: isRunning ? 1.5 : 0 
          }
        }}
        style={{
          // Ensure consistent rendering regardless of filter
          transform: `translateY(${isRunning ? '-180px' : '0px'}) scale(1)`,
          opacity: isRunning ? 0 : 1,
          // Force height to ensure proper sizing
          height: '24px',
          width: '100%'
        }}
      >
        <div 
          style={{
            width: '180px',
            height: '180px',
            position: 'absolute',
            top: '-90px',
            left: '50%',
            marginLeft: '-90px',
            backgroundImage: isDarkMode 
              ? `repeating-radial-gradient(
                  circle at center,
                  rgba(80, 80, 80, 0.6),
                  rgba(80, 80, 80, 0.6) 3px,
                  transparent 3px,
                  transparent 6px
                )`
              : `repeating-radial-gradient(
                  circle at center,
                  rgba(180, 180, 180, 0.3),
                  rgba(180, 180, 180, 0.3) 3px,
                  transparent 3px,
                  transparent 6px
                )`,
            rotate: isRunning ? `${rotation}deg` : '0deg',
            transition: isRunning ? 'none' : 'rotate 0.5s ease-out',
            border: isDarkMode 
              ? '4px solid rgba(30, 30, 30, 0.8)' 
              : '4px solid rgba(180, 180, 180, 0.3)',
            borderRadius: '50%',
            boxShadow: isDarkMode 
              ? '0 -5px 15px rgba(0,0,0,0.5)' 
              : '0 -5px 15px rgba(0,0,0,0.1)',
            opacity: isDarkMode ? 0.3 : 0.25,
            // Ensure consistent rendering regardless of mode or filter
            transform: 'scale(1)',
            transformOrigin: 'center center'
          }}
        >
          {/* Center hole */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '24px',
            height: '24px',
            marginLeft: '-12px',
            marginTop: '-12px',
            background: 'black',
            border: '2px solid #444',
            borderRadius: '50%',
            transform: 'scale(1)',
            transformOrigin: 'center center'
          }}></div>
          
          {/* Record label area */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '70px',
            height: '70px',
            marginLeft: '-35px',
            marginTop: '-35px',
            background: isDarkMode ? 'black' : '#555',
            opacity: isDarkMode ? 0.7 : 0.4,
            borderRadius: '50%',
            transform: 'scale(1)',
            transformOrigin: 'center center'
          }}></div>
        </div>
        </motion.div>

      {/* Edit button in top left corner */}
      <motion.button
        className={`absolute top-2 left-2 p-1 rounded-full
          ${isDarkMode 
            ? 'hover:bg-[#bccc0f]/30 text-[#bccc0f]' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          } z-30`}
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

      {/* Delete button in top right corner */}
      <motion.button
        className={`absolute top-2 right-2 p-1 rounded-full
          ${isDarkMode 
            ? 'hover:bg-[#bccc0f]/30 text-[#bccc0f]' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          } z-30`}
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(tool);
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </motion.button>

      {/* Updated Glow Effect Layer */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-lg z-10"
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

      {/* Card Content - Album Cover Style */}
      <div className="relative flex flex-col items-center justify-between h-full z-20 pt-4 pb-3">
        <div className="flex flex-col items-center">
          <motion.img 
            layout="position"
            src={tool.logoPath} 
            alt={tool.name}
            className="w-14 h-14 object-contain mb-2"
            style={{
              filter: isDarkMode ? 'drop-shadow(0 0 2px rgba(255,255,255,0.5))' : 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
            }}
          />
          <h3
            className={`text-lg font-semibold leading-tight mb-1 text-center px-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
            style={{
              textShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            {tool.name}
          </h3>
          <p
            className={`text-xs text-center line-clamp-2 px-3 leading-tight ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            {tool.description}
          </p>
        </div>

        {/* Album info section */}
        <div className="w-full mt-auto">
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} px-2`}>
            <p className="truncate max-w-full text-[10px]">
              <span className="font-medium">Path:</span> {tool.execution.rootPath}
            </p>
            <div className="flex items-center text-[10px] mt-1">
              <span className="font-medium flex-shrink-0">Command:</span> 
              <span className="truncate ml-1 flex-1">{tool.execution.command}</span>
              {tool.port && (
                <a
                  href={`http://localhost:${tool.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    // Only allow clicking if the app is running
                    if (!isRunning) {
                      e.preventDefault();
                      showNotification('App must be running to access the URL', 'warning');
                    }
                  }}
                  className={`ml-2 px-2 py-0.5 rounded text-[10px] whitespace-nowrap flex-shrink-0
                    ${isDarkMode 
                      ? 'bg-[#bccc0f]/20 text-[#bccc0f] hover:bg-[#bccc0f]/30' 
                      : 'bg-[#bccc0f]/20 text-[#857c00] hover:bg-[#bccc0f]/30'}`}
                >
                  Port: {tool.port}
                </a>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="mt-2 px-2">
            <motion.button
              layout="position"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAction}
              disabled={isStarting || isStopping}
              className={`
                w-full h-[40px] px-4 rounded-lg relative
                transition-all duration-200
                ${getButtonStyle()}
                ${(isStarting || isStopping) ? 'cursor-wait' : 'cursor-pointer'}
              `}
              style={{
                boxShadow: isDarkMode ? '0 0 8px rgba(188,204,15,0.2)' : '0 0 8px rgba(0,0,0,0.1)'
              }}
            >
              {getButtonContent()}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Error message under button */}
      <AnimatePresence>
        {runError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute bottom-1 left-0 right-0 text-center z-20"
          >
            <p className="text-xs text-red-500 truncate px-4">{runError}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ToolCard; 