import HeartbeatMonitor from './HeartbeatMonitor';
import { useTheme } from '../../context/ThemeContext';

function Footer() {
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
        <HeartbeatMonitor name="Merlin" ip="192.168.24.100" />
        <span className={`
          text-xs font-medium
          ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}
        `}>
          LUXSON © 2025
        </span>
        <HeartbeatMonitor name="Galahad" ip="192.168.24.6" />
      </div>
    </footer>
  );
}

export default Footer; 