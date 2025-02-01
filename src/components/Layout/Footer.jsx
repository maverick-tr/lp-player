import HeartbeatMonitor from './HeartbeatMonitor';
import { useTheme } from '../../context/ThemeContext';

function Footer() {
  const { isDarkMode } = useTheme();
  
  return (
    <footer className={`
      fixed bottom-0 left-0 right-0 py-3 px-4
      ${isDarkMode ? 'bg-tool-darker' : 'bg-white'}
      border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}
    `}>
      <div className="container mx-auto flex justify-between items-center">
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