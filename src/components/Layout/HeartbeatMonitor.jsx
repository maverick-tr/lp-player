import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

function HeartbeatMonitor({ name, ip }) {
  const { isDarkMode } = useTheme();
  const [isAlive, setIsAlive] = useState(true);
  const [pingTime, setPingTime] = useState(null);
  
  useEffect(() => {
    const checkPing = async () => {
      try {
        const start = performance.now();
        const response = await fetch(`/api/ping/${ip}`);
        const end = performance.now();
        
        if (response.ok) {
          const data = await response.json();
          setIsAlive(data.isAlive);
          setPingTime(end - start);
        } else {
          setIsAlive(false);
          setPingTime(null);
        }
      } catch (error) {
        console.error('Ping failed:', error);
        setIsAlive(false);
        setPingTime(null);
      }
    };

    checkPing();
    const interval = setInterval(checkPing, 5000);
    return () => clearInterval(interval);
  }, [ip]);

  // Adjust heartbeat speed based on ping time
  const duration = pingTime ? Math.min(Math.max(pingTime / 100, 0.5), 2) : 1;
  
  // More realistic cardiac rhythm with varying amplitude based on ping time
  const heartbeatPoints = isAlive 
    ? `M0,20 L3,20 L6,20 L7,${pingTime ? Math.min(10 + pingTime/10, 15) : 10} L9,${pingTime ? Math.max(25 - pingTime/10, 20) : 30} L10,20 L12,20 L14,20 L15,${pingTime ? Math.min(15 + pingTime/10, 20) : 15} L16,${pingTime ? Math.max(20 - pingTime/10, 15) : 25} L17,20 L40,20`
    : "M0,20 L40,20";
  
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`
        text-xs sm:text-sm font-medium whitespace-nowrap
        ${isDarkMode ? 'text-[#bccc0f]' : 'text-gray-800'}
      `}>
        {name}
      </span>
      <div className="relative w-24 sm:w-32 h-8">
        <motion.svg
          width="100%"
          height="100%"
          viewBox="0 0 40 40"
          className="absolute inset-0"
        >
          <motion.path
            d={heartbeatPoints}
            fill="none"
            strokeWidth="1.5"
            stroke={isAlive 
              ? (isDarkMode ? '#bccc0f' : '#000000')
              : '#ff0000'
            }
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: 1, 
              opacity: 1,
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: "easeInOut",
              repeatType: "loop"
            }}
          />
        </motion.svg>
      </div>
    </div>
  );
}

export default HeartbeatMonitor; 