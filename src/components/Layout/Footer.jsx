import { useTheme } from '../../hooks/useTheme';
import { memo } from 'react';
import SystemMonitor from './SystemMonitor';

// Use memo to prevent unnecessary re-renders
const Footer = memo(function Footer() {
  const { isDarkMode } = useTheme();
  
  return (
    <footer className={`
      fixed bottom-0 w-full py-4
      transition-colors duration-200
      z-50
      ${isDarkMode 
        ? 'bg-[#000000] text-gray-400'
        : 'bg-white text-gray-600'
      }
      border-t
      ${isDarkMode 
        ? 'border-tool-border' 
        : 'border-gray-200'
      }
      shadow-lg
    `}>
      <div className="container mx-auto px-4 flex justify-between items-center backdrop-blur-none">
        <SystemMonitor name="CPU" type="cpu" />
        <span className={`
          text-xs font-medium
          ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}
        `}>
          LAP - Local App Manager © 2025
        </span>
        <SystemMonitor name="Memory" type="memory" />
      </div>
    </footer>
  );
});

export default Footer; 