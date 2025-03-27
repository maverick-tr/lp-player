import { useTheme } from '../../hooks/useTheme';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { useState, memo } from 'react';
import AddAppModal from '../Modals/AddAppModal';

const Header = memo(function Header() {
  const { isDarkMode } = useTheme();
  const [showAddAppModal, setShowAddAppModal] = useState(false);

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
              alt="LPP - Local Project Player" 
              className="h-24 w-auto object-contain"
              initial={{ scale: 1 }}
              animate={[
                // Simplified animation to reduce rendering overhead
                {
                  scale: [1, 1.05, 1],
                  transition: {
                    duration: 2,
                    times: [0, 0.5, 1],
                    repeat: Infinity,
                    repeatDelay: 3
                  }
                }
              ]}
              whileHover={{ scale: 1.05 }}
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