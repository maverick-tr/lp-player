import { useState, useRef, useEffect } from 'react';
import { SunIcon, MoonIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

function ThemeToggle() {
  const { isDarkMode, toggleTheme, sepiaValue, setSepiaValue, hueValue, setHueValue } = useTheme();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  const handleTogglePopover = () => {
    setIsPopoverOpen(prev => !prev);
  };

  const handleSepiaChange = (event) => {
    setSepiaValue(Number(event.target.value));
  };

  const handleHueChange = (event) => {
    setHueValue(Number(event.target.value));
  };

  // Close popover if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverRef, buttonRef]);

  const popoverVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.1 } },
  };

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleTogglePopover}
        aria-label="Open theme settings"
        className={`
          p-2 rounded-full transition-colors
          ${isDarkMode
            ? 'bg-tool-light hover:bg-tool-accent-light'
            : 'bg-tool-light-mode-card hover:bg-gray-200'
          }
        `}
      >
        <AdjustmentsHorizontalIcon className={`w-5 h-5 ${isDarkMode ? 'text-[#bccc0f]' : 'text-tool-light-mode-accent'}`} />
      </motion.button>

      <AnimatePresence>
        {isPopoverOpen && (
          <motion.div
            ref={popoverRef}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={popoverVariants}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`
              absolute right-0 mt-2 w-48 p-4 rounded-lg shadow-xl z-50
              ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 border border-gray-200'}
            `}
            style={{ top: 'calc(100% + 0.5rem)' }} // Position below the button
          >
            <div className="space-y-4">
              {/* Dark/Light Mode Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Mode</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleTheme}
                  aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  className={`
                    p-1.5 rounded-full transition-colors
                    ${isDarkMode
                      ? 'bg-tool-light hover:bg-tool-accent-light'
                      : 'bg-tool-light-mode-card hover:bg-gray-200'
                    }
                  `}
                >
                  {isDarkMode ? (
                    <SunIcon className="w-4 h-4 text-[#bccc0f]" />
                  ) : (
                    <MoonIcon className="w-4 h-4 text-tool-light-mode-accent" />
                  )}
                </motion.button>
              </div>

              {/* Sepia Slider */}
              <div className="space-y-1">
                <label htmlFor="sepiaSlider" className="text-sm font-medium block">Sepia</label>
                <input
                  id="sepiaSlider"
                  type="range"
                  min="0"
                  max="100"
                  value={sepiaValue}
                  onChange={handleSepiaChange}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 slider-thumb"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 block text-right">{sepiaValue}%</span>
              </div>

              {/* Hue Rotation Slider - NEW */}
              <div className="space-y-1">
                <label htmlFor="hueSlider" className="text-sm font-medium block">Color Hue</label>
                <input
                  id="hueSlider"
                  type="range"
                  min="0"
                  max="360"
                  value={hueValue}
                  onChange={handleHueChange}
                  className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 hue-slider-thumb"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 block text-right">{hueValue}°</span>
              </div>

              {/* Combined Styles for Slider Thumbs */}
              <style jsx global>{`
                .slider-thumb::-webkit-slider-thumb,
                .hue-slider-thumb::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  background: ${isDarkMode ? '#bccc0f' : '#5856d6'}; /* Adjust thumb color based on mode */
                  border-radius: 50%;
                  cursor: pointer;
                }
                .slider-thumb::-moz-range-thumb,
                .hue-slider-thumb::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  background: ${isDarkMode ? '#bccc0f' : '#5856d6'}; /* Adjust thumb color based on mode */
                  border-radius: 50%;
                  cursor: pointer;
                  border: none;
                }
                /* Style for hue slider track */
                input[type=range]#hueSlider {
                  background: linear-gradient(to right, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%));
                }
              `}</style>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ThemeToggle; 