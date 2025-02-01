import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import { motion } from 'framer-motion';

function Header() {
  const { isDarkMode } = useTheme();

  return (
    <header className={`
      py-4 sm:py-6 shadow-lg transition-colors duration-200
      ${isDarkMode ? 'bg-tool-darker' : 'bg-white'}
    `}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Center logo */}
          <div className="flex-1" /> {/* Spacer */}
          <div className="flex items-center justify-center">
            <motion.img
              src="/images/luxson.png"
              alt="Luxson Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
              initial={{ scale: 1 }}
              animate={[
                // Initial animation sequence
                {
                  scale: [1, 1.05, 1],
                  transition: {
                    duration: 1,
                    times: [0, 0.5, 1],
                    repeat: 1,
                    repeatDelay: 0.5
                  }
                },
                // Continuous glow effect
                {
                  filter: [
                    isDarkMode 
                      ? 'drop-shadow(0 0 25px rgba(188,204,15,0.7))'
                      : 'drop-shadow(0 0 15px rgba(188,204,15,0.15))',
                    isDarkMode 
                      ? 'drop-shadow(0 0 40px rgba(188,204,15,0.9))'
                      : 'drop-shadow(0 0 25px rgba(188,204,15,0.25))',
                    isDarkMode 
                      ? 'drop-shadow(0 0 25px rgba(188,204,15,0.7))'
                      : 'drop-shadow(0 0 15px rgba(188,204,15,0.15))'
                  ],
                  transition: {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2.5
                  }
                }
              ]}
              whileHover={{ scale: 1.05 }}
            />
          </div>
          <div className="flex-1 flex justify-end">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header; 