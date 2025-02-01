import { ToolProvider } from './context/ToolContext';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/ThemeContext';
import ToolGrid from './components/ToolGrid/ToolGrid';
import SearchBar from './components/Search/SearchBar';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';

function AppContent() {
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
}

function App() {
  return (
    <ThemeProvider>
      <ToolProvider>
        <AppContent />
      </ToolProvider>
    </ThemeProvider>
  );
}

export default App; 