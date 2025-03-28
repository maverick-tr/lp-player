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

// Use memo for the AppContent component to prevent unnecessary re-renders
const AppContent = memo(function AppContent() {
  const { isDarkMode } = useTheme();
  const { isTerminalOpen, activeToolName, terminalOutput, closeTerminal, isConnected, isTerminalMinimized } = useTerminal();

  return (
    <div className={`
      min-h-screen transition-colors duration-200 pb-16
      ${isDarkMode ? 'bg-tool-dark text-white' : 'bg-tool-light-mode-bg text-tool-light-mode-text'}
    `}>
      <Header />
      {/* Terminal is fixed positioned, no need for spacing */}
      <div className="h-[140px] w-full"></div>
      <main className="container mx-auto px-4 py-8">
        <SearchBar />
        <ToolGrid />
      </main>
      <Footer />
      <TerminalWindow 
        isOpen={isTerminalOpen}
        toolName={activeToolName}
        output={terminalOutput}
        onClose={closeTerminal}
        isConnected={isConnected}
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
            <AppContent />
          </TerminalProvider>
        </ToolProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App; 