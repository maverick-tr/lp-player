import { motion } from 'framer-motion';
import { useTools } from '../../context/ToolContext';
import { AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useRef, useEffect, useState } from 'react';

function ToolCard({ tool, onCheckout }) {
  const { checkouts, checkinTool } = useTools();
  const { isDarkMode } = useTheme();
  const toolCheckouts = checkouts[tool.id] || [];
  const isCheckedOut = toolCheckouts.length > 0;
  const isMaxedOut = toolCheckouts.length >= tool.maxCheckouts;
  const cardRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const firstGlowColor = isMaxedOut
    ? (isDarkMode ? 'rgba(128,0,0,0.25)' : 'rgba(128,0,0,0.3)')
    : (isDarkMode ? 'rgba(188,204,15,0.15)' : 'rgba(188,204,15,0.12)');

  const secondGlowColor = isMaxedOut
    ? (isDarkMode ? 'rgba(128,0,0,0.15)' : 'rgba(128,0,0,0.2)')
    : (isDarkMode ? 'rgba(188,204,15,0.05)' : 'rgba(188,204,15,0.06)');

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleAction = () => {
    if (tool.requiresCheckout) {
      onCheckout();
    } else if (tool.type === 'download') {
      // Handle local files differently from absolute URLs
      const isLocalFile = tool.url.startsWith('/');
      if (isLocalFile) {
        // For local files, trigger download using the file name
        const fileName = tool.url.split('/').pop();
        fetch(tool.url)
          .then(response => response.blob())
          .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName; // This will be the suggested file name
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          })
          .catch(error => console.error('Download failed:', error));
      } else {
        // For absolute URLs, open in new tab (browser will handle download)
        window.open(tool.url, '_blank');
      }
    } else {
      // Default 'open' behavior
      window.open(tool.url, '_blank');
    }
  };

  return (
    <motion.div 
      ref={cardRef}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative p-5 rounded-xl border transition-all duration-300
        h-[260px] flex flex-col justify-between overflow-hidden
        ${isDarkMode
          ? isCheckedOut 
            ? 'border-tool-border bg-gradient-to-br from-tool-border/10 to-transparent' 
            : 'border-tool-border bg-tool-light'
          : isCheckedOut
            ? 'border-black bg-gradient-to-br from-gray-100 to-white' 
            : 'border-black bg-white'
        }
      `}
      style={{
        '--card-bg': isDarkMode ? 'rgba(188,204,15,0.03)' : 'rgba(188,204,15,0.015)'
      }}
    >
      {/* Updated Glow Effect Layer */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          backgroundImage: `radial-gradient(
            600px circle at ${mousePosition.x}px ${mousePosition.y}px,
            ${firstGlowColor} 0%,
            ${secondGlowColor} 20%,
            transparent 50%
          )`,
          mixBlendMode: isDarkMode ? 'screen' : 'multiply'
        }}
      />

      {/* Card Content - Added will-change-transform to prevent text jerking */}
      <div className="relative z-10 will-change-transform">
        <div className="flex flex-col items-center h-[130px]">
          <motion.img 
            layout="position"
            src={tool.logoPath} 
            alt={tool.name}
            className="w-12 h-12 object-contain mb-1"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          />
          <h3  // Removed motion from text elements
            className={`text-lg font-semibold leading-tight mb-1 ${
              isDarkMode ? 'text-white' : 'text-tool-light-mode-text'
            }`}
          >
            {tool.name}
          </h3>
          <p  // Removed motion from text elements
            className={`text-sm text-center line-clamp-2 px-1 leading-snug ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {tool.description}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-[44px]">
          <AnimatePresence>
            {toolCheckouts.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-wrap gap-1 justify-center"
              >
                {toolCheckouts.map((checkout, index) => (
                  <motion.div 
                    key={index}
                    className={`
                      flex items-center gap-1 px-2 py-0.5 rounded-full
                      ${isDarkMode 
                        ? 'bg-tool-accent/20 text-tool-accent'
                        : 'bg-gray-100 text-gray-700'
                      }
                    `}
                  >
                    <span className="text-xs">
                      {checkout.initials}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => checkinTool(tool.id, checkout.initials)}
                      className={`
                        text-xs hover:text-red-500 transition-colors
                        ${isDarkMode ? 'text-tool-accent' : 'text-gray-500'}
                      `}
                    >
                      ×
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-[36px]">
          <motion.button
            layout="position"
            whileHover={{ 
              scale: isMaxedOut ? 1 : 1.02,
              boxShadow: tool.requiresCheckout
                ? isDarkMode 
                  ? '0 0 15px rgba(188,204,15,0.3)'
                  : '0 0 15px rgba(188,204,15,0.2)'
                : isDarkMode
                  ? '0 0 20px rgba(188,204,15,0.5)'
                  : '0 0 20px rgba(188,204,15,0.4)'
            }}
            whileTap={{ scale: isMaxedOut ? 1 : 0.98 }}
            onClick={handleAction}
            disabled={tool.requiresCheckout && isMaxedOut}
            className={`
              w-full h-full px-4 rounded-lg 
              transition-all duration-200
              ${tool.requiresCheckout 
                ? isMaxedOut 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-tool-accent text-tool-darker hover:bg-tool-accent/90'
                    : 'bg-tool-light-mode-button text-white hover:bg-tool-light-mode-button-hover'
                : isDarkMode
                  ? 'bg-tool-accent text-tool-darker hover:bg-tool-accent/90 border-2 border-[#bccc0f]/30'
                  : 'bg-tool-light-mode-button text-white hover:bg-tool-light-mode-button-hover border-2 border-[#bccc0f]/20'
              }
            `}
          >
            {tool.requiresCheckout
              ? isMaxedOut 
                ? 'Max Checkouts Reached' 
                : 'Checkout'
              : tool.type === 'download'
                ? 'Download'
                : 'Open'
            }
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default ToolCard; 