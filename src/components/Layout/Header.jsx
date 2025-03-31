import { useTheme } from '../../hooks/useTheme';
import { motion, useTransform, useMotionValue } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { useState, memo, useEffect } from 'react';
import AddAppModal from '../Modals/AddAppModal';
import { useTools } from '../../hooks/useTools';

const Header = memo(function Header() {
  const { isDarkMode } = useTheme();
  const { tools } = useTools();
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const rotate = useMotionValue(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(0);

  // Count how many apps are currently running
  useEffect(() => {
    const runningApps = tools.filter(tool => tool.execution?.isRunning).length;
    
    if (runningApps > 0) {
      // Calculate spin speed based on number of running apps
      // Base speed is 5 seconds per rotation, faster as more apps run
      // Min rotation time is 1 second when all apps are running (assuming max of 10 apps)
      const maxApps = 10; // Assume maximum 10 apps for full speed
      const minDuration = 1; // 1 second for fastest rotation
      const maxDuration = 5; // 5 seconds for slowest rotation
      
      // Calculate duration inversely proportional to number of running apps
      const duration = maxDuration - ((runningApps / maxApps) * (maxDuration - minDuration));
      
      setSpinSpeed(duration);
      setIsSpinning(true);
    } else {
      setIsSpinning(false);
    }
  }, [tools]);

  return (
    <header className={`
      py-6 transition-colors duration-200
      ${isDarkMode ? 'bg-tool-darker' : 'bg-white'}
    `}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Left side - Add Button */}
          <div className="w-10">
            <motion.button
              onClick={() => setShowAddAppModal(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`
                flex items-center justify-center w-8 h-8 rounded-full
                ${isDarkMode 
                  ? 'bg-tool-light text-[#bccc0f] hover:bg-tool-accent-light' 
                  : 'bg-tool-light-mode-card text-tool-light-mode-accent hover:bg-gray-200'
                }
                transition-colors duration-200
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </div>
          
          {/* Centered Logo */}
          <div className="flex justify-center flex-1">
            <motion.img 
              src="/logo.png?v=1.0.0" 
              alt="LP Player - Local Project Player" 
              className="h-24 w-auto object-contain"
              initial={{ scale: 1, rotate: 0 }}
              animate={isSpinning ? {
                rotate: 360,
                transition: {
                  duration: spinSpeed,
                  ease: "linear",
                  repeat: Infinity,
                  repeatType: "loop"
                }
              } : {
                scale: [1, 1.05, 1],
                transition: {
                  duration: 2,
                  times: [0, 0.5, 1],
                  repeat: Infinity,
                  repeatDelay: 3
                }
              }}
              whileHover={{ scale: 1.05 }}
              style={{ originX: 0.5, originY: 0.5 }}
            />
          </div>
          
          {/* Theme Toggle on right */}
          <div className="w-10">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Add App Modal */}
      {showAddAppModal && (
        <AddAppModal onClose={() => setShowAddAppModal(false)} />
      )}
    </header>
  );
});

export default Header; 