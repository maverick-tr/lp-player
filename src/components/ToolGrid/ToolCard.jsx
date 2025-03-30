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
    }
  }, [isRunning, isStarting, isStopping]);

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
    } else {
      setRunError(null);
    }
  }, [tool.execution.error, tool.name, showNotification]);

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
      // Start the stopping animation/state change
      setIsStopping(true);
      setButtonState('draining'); // Indicate stopping process
      
      // Call stopApp directly - the UI will update based on context changes
      const result = await stopApp(tool.id);
      if (!result.success) {
        // If stop failed, revert state
        setIsStopping(false);
        setButtonState('stop'); // Revert to 'stop' as it's still technically running
        showNotification(`Failed to stop ${tool.name}: ${result.error}`, 'error');
      } else {
        // Stop succeeded, reset local state. isRunning will update via context.
        setIsStopping(false);
        setButtonState('run'); // Set to 'run' state ready for next action
      }
    } else {
      // Start the starting animation/state change
      setIsStarting(true);
      setButtonState('starting'); // Indicate starting process
      
      // Call runApp directly - UI updates based on context
      const result = await runApp(tool.id);
      if (!result.success) {
        // If start failed, revert state
        setIsStarting(false);
        setButtonState('run');
        showNotification(`Failed to start ${tool.name}: ${result.error}`, 'error');
      } else {
         // Start initiated, wait for context to confirm 'isRunning'
         // We can potentially reset isStarting here, or let context handle it
         // For now, reset isStarting after a short delay to allow transition
         setTimeout(() => setIsStarting(false), 500); 
      }
    }
  };

  // Derived state for cleaner transition checks
  const isTransitioning = isStarting || isStopping || buttonState === 'waiting';

  // Get the appropriate button style based on current state
  const getButtonStyle = () => {
    // Base style is transparent, specific styles applied within getButtonContent
    return 'bg-transparent'; 
  };

  // Get the button content based on current state (NEW POWER KNOB DESIGN)
  const getButtonContent = () => {
    const knobSize = 28; // Size of the knob in pixels
    const plateSize = 40; // Size of the background plate
    const rotationAngle = isRunning ? 135 : -135; // Rotation for ON/OFF

    const knobVariants = {
      idle: { scale: 1, boxShadow: isDarkMode ? '0px 2px 5px rgba(0, 0, 0, 0.4)' : '0px 2px 5px rgba(0, 0, 0, 0.2)' },
      hover: { scale: 1.05, boxShadow: isDarkMode ? '0px 4px 10px rgba(0, 0, 0, 0.5)' : '0px 4px 10px rgba(0, 0, 0, 0.3)' },
      tap: { scale: 0.95 }
    };

    const glowVariants = {
      hidden: { opacity: 0, scale: 0.8 },
      visible: {
        opacity: [0, 0.7, 0.3, 0.7, 0], // Pulse effect
        scale: [0.8, 1.1, 1, 1.1, 0.8],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        {/* Power Knob Container */}
        <div 
          className="relative flex items-center justify-center cursor-pointer group"
          style={{ width: plateSize, height: plateSize }}
          onClick={!isTransitioning ? handleAction : undefined} // Prevent click during transition
        >
          {/* Background Plate */}
          <div 
            className={`absolute inset-0 rounded-full transition-colors duration-300
              ${isDarkMode 
                ? 'bg-gradient-to-br from-[#3a3a3a] to-[#1a1a1a] border border-[#444] shadow-inner' 
                : 'bg-gradient-to-br from-[#f0f0f0] to-[#d0d0d0] border border-[#bbb] shadow-inner'
              }`}
          >
            {/* Subtle Texture */}
             <div className="absolute inset-0 rounded-full opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
          </div>

          {/* OFF Label */}
          <span 
            className={`absolute top-1/2 -translate-y-1/2 left-[-16px] text-[8px] font-mono font-bold transition-colors duration-300
              ${!isRunning ? (isDarkMode ? 'text-[#bccc0f]' : 'text-red-600') : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}
            `}
          >
            OFF
          </span>

          {/* ON Label */}
          <span 
            className={`absolute top-1/2 -translate-y-1/2 right-[-14px] text-[8px] font-mono font-bold transition-colors duration-300
              ${isRunning ? (isDarkMode ? 'text-[#bccc0f]' : 'text-green-600') : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}
            `}
          >
            ON
          </span>

          {/* Rotating Knob */}
          <motion.div
            className="relative z-10 rounded-full shadow-md"
            style={{ 
              width: knobSize, 
              height: knobSize,
              background: isDarkMode 
                ? 'radial-gradient(circle at 70% 30%, #666, #333)' 
                : 'radial-gradient(circle at 70% 30%, #e0e0e0, #a0a0a0)',
              border: `1px solid ${isDarkMode ? '#555' : '#aaa'}`,
            }}
            variants={knobVariants}
            initial="idle"
            whileHover={!isTransitioning ? "hover" : "idle"}
            whileTap={!isTransitioning ? "tap" : "idle"}
            animate={{ 
              rotate: rotationAngle, 
              boxShadow: isTransitioning ? 'none' : (isDarkMode ? '0px 2px 5px rgba(0, 0, 0, 0.4)' : '0px 2px 5px rgba(0, 0, 0, 0.2)') 
            }}
            transition={{ 
              rotate: { type: "spring", stiffness: 200, damping: 20 },
              default: { duration: 0.15 } 
            }}
          >
            {/* Knob Indicator Dot */}
            <div 
              className="absolute top-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
              style={{ background: isDarkMode ? '#bccc0f' : '#444' }}
            ></div>
             {/* Subtle center dimple */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-black/20' : 'bg-black/10'} shadow-inner`}></div>

            {/* Pulsing Glow for Transition State */}
            <motion.div
              className="absolute inset-[-4px] rounded-full pointer-events-none"
              style={{
                border: `2px solid ${isDarkMode ? 'rgba(188, 204, 15, 0.7)' : 'rgba(100, 116, 139, 0.7)'}` , // Yellowish or grayish glow
                boxShadow: `0 0 10px 2px ${isDarkMode ? 'rgba(188, 204, 15, 0.5)' : 'rgba(100, 116, 139, 0.5)'}`
              }}
              variants={glowVariants}
              initial="hidden"
              animate={isTransitioning ? "visible" : "hidden"}
            />
          </motion.div>
        </div>

        {/* Status text below the knob => Replaced with Loading Dots */}
        <div className="absolute bottom-[-14px] text-center w-full h-4 flex justify-center items-center"> {/* Increased bottom offset further */}
          {/* Loading Dots Container - Animates visibility and staggers children */}
          <motion.div
            className="flex space-x-1"
            initial="hidden"
            animate={isTransitioning ? "visible" : "hidden"}
            variants={{
              visible: { 
                opacity: 1, 
                transition: { staggerChildren: 0.15 }
              },
              hidden: { opacity: 0 }
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-[#bccc0f]' : 'bg-yellow-600'}`}
                variants={{
                  visible: {
                    opacity: [0.4, 1, 0.4], // Blink effect
                    scale: [0.8, 1, 0.8],
                    transition: {
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  },
                  hidden: { opacity: 0, scale: 0 }
                }}
              />
            ))}
          </motion.div>
        </div>
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
            backgroundImage: `repeating-radial-gradient(
                circle at center,
                ${isDarkMode ? 'rgba(80, 80, 80, 0.6)' : 'rgba(180, 180, 180, 0.3)'} 0px,
                ${isDarkMode ? 'rgba(80, 80, 80, 0.6)' : 'rgba(180, 180, 180, 0.3)'} 3px,
                transparent 3px,
                transparent 6px
              )`,
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
            <div
              className={`
                w-full h-[40px] px-4 rounded-lg relative
                flex items-center justify-center
                transition-all duration-200
                ${getButtonStyle()}
                ${isTransitioning ? 'cursor-wait' : ''}
              `}
              style={{
                boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {getButtonContent()}
            </div>
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