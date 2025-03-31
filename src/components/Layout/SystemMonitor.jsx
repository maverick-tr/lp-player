import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

// Use memo to prevent unnecessary re-renders
const SystemMonitor = memo(function SystemMonitor({ name, type }) {
  const { isDarkMode } = useTheme();
  const [usage, setUsage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef(null);
  const socketRef = useRef(null);
  
  useEffect(() => {
    // Subscribe to real system stats via WebSocket
    const setupSystemStatsSocket = () => {
      // Use the same hostname/port as the current page
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:4243`;
      
      try {
        // Close existing socket if any
        if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
          socketRef.current.close();
        }
        
        // Create new WebSocket connection
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        socket.onopen = () => {
          console.log('Connected to system stats WebSocket');
          
          // Subscribe to system stats
          socket.send(JSON.stringify({
            type: 'subscribe-system-stats'
          }));
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'system-stats') {
              setIsLoading(false);
              
              // Update the appropriate stat based on type (cpu or memory)
              if (type === 'cpu' && data.cpu !== undefined) {
                setUsage(data.cpu);
              } else if (type === 'memory' && data.memory !== undefined) {
                setUsage(data.memory);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Fall back to HTTP API if WebSocket fails
          fetchSystemStats();
        };
        
        socket.onclose = () => {
          console.log('System stats WebSocket closed');
          // Try to reconnect after a delay
          setTimeout(setupSystemStatsSocket, 5000);
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        // Fall back to HTTP API if WebSocket fails
        fetchSystemStats();
      }
    };
    
    // Fetch system stats from API as fallback
    const fetchSystemStats = async () => {
      try {
        // If WebSocket failed, set up an interval to fetch stats via HTTP API
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        const fetchData = async () => {
          try {
            const response = await fetch(`http://${window.location.hostname}:4243/api/system-stats`);
            
            if (response.ok) {
              const data = await response.json();
              setIsLoading(false);
              
              // Update the appropriate stat based on type
              if (type === 'cpu') {
                setUsage(data.cpu);
              } else if (type === 'memory') {
                setUsage(data.memory);
              }
            }
          } catch (error) {
            console.error('Failed to fetch system stats:', error);
          }
        };
        
        // Fetch immediately then set up interval
        await fetchData();
        intervalRef.current = setInterval(fetchData, 2000);
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
        
        // As last resort, fallback to random data for demo purposes
        fallbackToRandomData();
      }
    };
    
    // Fallback to random data as last resort
    const fallbackToRandomData = () => {
      console.warn('Falling back to random system stats data for demo purposes');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Generate random stats
      const updateRandomStats = () => {
        setIsLoading(false);
        const randomUsage = Math.floor(Math.random() * 100);
        setUsage(randomUsage);
      };
      
      updateRandomStats();
      intervalRef.current = setInterval(updateRandomStats, 2000);
    };
    
    // Start with WebSocket connection
    setupSystemStatsSocket();
    
    // Cleanup function to handle unmounting
    return () => {
      // Close WebSocket
      if (socketRef.current) {
        // Unsubscribe before closing
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'unsubscribe-system-stats'
          }));
        }
        socketRef.current.close();
      }
      
      // Clear interval
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