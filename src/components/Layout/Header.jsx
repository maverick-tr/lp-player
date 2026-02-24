import { useTheme } from '../../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, memo, useEffect } from 'react';
import AddAppModal from '../Modals/AddAppModal';
import UnifiedSettingsModal from '../Modals/UnifiedSettingsModal';
import { useTools } from '../../hooks/useTools';
import { useSound } from '../../hooks/useSound';
import NowPlayingCard from './NowPlayingCard';

const vinylContainerVariants = {
  center: {
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  left: {
    x: -48,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  }
};

const cardVariants = {
  hidden: {
    x: 250,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: {
    x: -120,
    opacity: 0,
    transition: { duration: 0.5 }
  }
};

const Header = memo(function Header() {
  const { isDarkMode } = useTheme();
  const { tools } = useTools();
  const { phase, nowPlaying, analyserRef } = useSound();
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(0);

  const showCard = phase === 'slide-out' || phase === 'hold';
  const vinylSlid = phase === 'slide-out' || phase === 'hold';

  // Count how many apps are currently running
  useEffect(() => {
    const runningApps = tools.filter(tool => tool.execution?.isRunning).length;

    if (runningApps > 0) {
      const maxApps = 10;
      const minDuration = 1;
      const maxDuration = 5;
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
      ${isDarkMode ? 'bg-tool-dark' : 'bg-tool-light-mode-bg'}
    `}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Left side - Add App Button */}
          <div className="w-10">
            <motion.button
              data-onboarding="add-app"
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

          {/* Centered Logo + Now Playing */}
          <div className="flex justify-center items-center flex-1 relative">
            {/* Vinyl container: handles horizontal slide */}
            <motion.div
              variants={vinylContainerVariants}
              animate={vinylSlid ? 'left' : 'center'}
              initial="center"
            >
              {/* Inner img: handles spin rotation */}
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
            </motion.div>

            {/* Now Playing Card */}
            <AnimatePresence>
              {showCard && nowPlaying && (
                <motion.div
                  key="now-playing"
                  className="absolute left-1/2"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <NowPlayingCard nowPlaying={nowPlaying} analyserRef={analyserRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings on right */}
          <div className="w-10">
            <motion.button
              data-onboarding="settings"
              onClick={() => setShowSettingsModal(true)}
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
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {showAddAppModal && (
        <AddAppModal onClose={() => setShowAddAppModal(false)} />
      )}
      {showSettingsModal && (
        <UnifiedSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </header>
  );
});

export default Header;
