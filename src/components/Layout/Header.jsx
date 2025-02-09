import { useTheme } from '../../context/ThemeContext';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

function Header() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className={`
      py-6 transition-colors duration-200
      ${isDarkMode ? 'bg-tool-darker' : 'bg-white'}
    `}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Spacer for left side */}
          <div className="w-10" /> 
          
          {/* Centered Logo */}
          <div className="flex justify-center flex-1">
            <motion.img 
              src="/images/luxson.png" 
              alt="Luxson" 
              className="h-24 w-auto object-contain"
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
                // Glow animation
                {
                  filter: [
                    `brightness(1) drop-shadow(0 0 15px ${isDarkMode ? 'rgba(188,204,15,0.4)' : 'rgba(188,204,15,0.1)'})`,
                    `brightness(1.1) drop-shadow(0 0 25px ${isDarkMode ? 'rgba(188,204,15,0.6)' : 'rgba(188,204,15,0.2)'})`,
                    `brightness(1) drop-shadow(0 0 15px ${isDarkMode ? 'rgba(188,204,15,0.4)' : 'rgba(188,204,15,0.1)'})`
                  ],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
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
    </header>
  );
}

export default Header; 