import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className={`
        p-2 rounded-full transition-colors
        ${isDarkMode 
          ? 'bg-tool-light hover:bg-tool-accent-light' 
          : 'bg-tool-light-mode-card hover:bg-gray-200'
        }
      `}
    >
      {isDarkMode ? (
        <SunIcon className="w-5 h-5 text-[#bccc0f]" />
      ) : (
        <MoonIcon className="w-5 h-5 text-tool-light-mode-accent" />
      )}
    </motion.button>
  );
}

export default ThemeToggle; 