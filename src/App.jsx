import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ToolProvider } from './context/ToolContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { TerminalProvider } from './context/TerminalContext';
import { useTheme } from './hooks/useTheme';
import { useTerminal } from './hooks/useTerminal';
import ToolGrid from './components/ToolGrid/ToolGrid';
import SearchBar from './components/Search/SearchBar';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import TerminalWindow from './components/Terminal/TerminalWindow';
import { memo } from 'react';

// Main App component to wrap everything with context providers
const AppContent = memo(function AppContent() {
  const { isDarkMode, sepiaValue, hueValue } = useTheme();
  const { isTerminalOpen, activeToolName, terminalOutput, closeTerminal, isConnected, isTerminalMinimized } = useTerminal();

  // Calculate CSS filter values
  const sepiaFilterValue = sepiaValue / 100;
  const hueRotateValue = hueValue; // Assuming hueValue is already in degrees (0-360)

  return (
    <div 
      className={`
        min-h-screen transition-colors duration-200
        ${isDarkMode ? 'bg-tool-dark text-white' : 'bg-tool-light-mode-bg text-tool-light-mode-text'}
      `}
      style={{
        filter: `sepia(${sepiaFilterValue}) hue-rotate(${hueRotateValue}deg)`,
        transition: 'filter 0.2s ease-in-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out'
      }}
    >
      <Toaster position="bottom-right" />
      <Header />
      {/* Only add spacing when terminal is open AND maximized - reduced to match mt-8 */}
      {isTerminalOpen && !isTerminalMinimized && <div className="h-[108px] w-full"></div>}
      <main className="container mx-auto px-4 py-8 mb-16">
        <div className="pt-8">
          <SearchBar />
        </div>
        <ToolGrid />
      </main>
      <Footer />
      <TerminalWindow 
        isOpen={isTerminalOpen}
        toolName={activeToolName}
        output={terminalOutput}
        onClose={closeTerminal}
        isConnected={isConnected}
        style={{ zIndex: 99 }} // Ensure terminal stays on top
      />
    </div>
  );
});

function App() {
  document.title = "LPP - Local Project Player";
  
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToolProvider>
          <TerminalProvider>
            <Router>
              <AppContent />
            </Router>
          </TerminalProvider>
        </ToolProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App; 