import { ToolProvider } from './context/ToolContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { useTheme } from './hooks/useTheme';
import ToolGrid from './components/ToolGrid/ToolGrid';
import SearchBar from './components/Search/SearchBar';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import { memo } from 'react';

// Use memo for the AppContent component to prevent unnecessary re-renders
const AppContent = memo(function AppContent() {
  const { isDarkMode } = useTheme();

  return (
    <div className={`
      min-h-screen transition-colors duration-200 pb-16
      ${isDarkMode ? 'bg-tool-dark text-white' : 'bg-tool-light-mode-bg text-tool-light-mode-text'}
    `}>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <SearchBar />
        <ToolGrid />
      </main>
      <Footer />
    </div>
  );
});

function App() {
  document.title = "LAP - Local App Manager";
  
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToolProvider>
          <AppContent />
        </ToolProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App; 