import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

// Use memo to prevent unnecessary re-renders
const SystemMonitor = memo(function SystemMonitor({ name, type }) {
  const { isDarkMode } = useTheme();
  const [usage, setUsage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    // Cleanup function to handle unmounting
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    // Single function to update stats
    const updateStats = () => {
      try {
        // For this demo, we'll simulate random usage values
        setIsLoading(false);
        
        // Random usage value for demonstration
        const randomUsage = Math.floor(Math.random() * 100);
        setUsage(randomUsage);
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
        setIsLoading(false);
        setUsage(0);
      }
    };

    // Run once immediately
    updateStats();
    
    // Setup interval using ref to prevent unnecessary effect reruns
    intervalRef.current = setInterval(updateStats, 2000);
    
    // Clean up on unmount or when type changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [type]);

  // Determine color based on usage
  const getColor = () => {
    if (usage < 50) return isDarkMode ? '#4ade80' : '#22c55e'; // Green
    if (usage < 80) return isDarkMode ? '#facc15' : '#eab308'; // Yellow
    return isDarkMode ? '#ef4444' : '#dc2626'; // Red
  };
  
  // Different graph patterns for CPU and Memory
  const getGraphPath = () => {
    if (type === 'cpu') {
      // CPU pattern - spiky line
      return `M0,20 L5,${20 - usage * 0.15} L10,${20 - usage * 0.1} L15,${20 - usage * 0.18} L20,${20 - usage * 0.13} L25,${20 - usage * 0.2} L30,${20 - usage * 0.15} L35,${20 - usage * 0.14} L40,${20 - usage * 0.12}`;
    } else {
      // Memory pattern - smoother line
      return `M0,20 L10,${20 - usage * 0.15} L20,${20 - usage * 0.16} L30,${20 - usage * 0.17} L40,${20 - usage * 0.15}`;
    }
  };
  
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`
        text-xs sm:text-sm font-medium whitespace-nowrap
        ${isDarkMode ? 'text-[#bccc0f]' : 'text-gray-800'}
      `}>
        {name}
      </span>
      
      <div className="relative w-24 sm:w-32 h-8 flex items-center">
        {isLoading ? (
          <div className="text-xs text-gray-400">Loading...</div>
        ) : (
          <>
            <motion.svg
              width="100%"
              height="100%"
              viewBox="0 0 40 40"
              className="absolute inset-0"
            >
              <motion.path
                d={getGraphPath()}
                fill="none"
                strokeWidth="1.5"
                stroke={getColor()}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: 1, 
                  opacity: 1,
                }}
                transition={{
                  duration: 1,
                  ease: "easeInOut"
                }}
              />
            </motion.svg>
            
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <span 
                className="text-xs font-mono"
                style={{ color: getColor() }}
              >
                {usage}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default SystemMonitor; 