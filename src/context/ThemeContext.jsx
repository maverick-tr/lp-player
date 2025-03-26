import { createContext, useState, useEffect } from 'react';

// Export the context directly
export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize with session preference or default to dark
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = sessionStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // Save to sessionStorage whenever theme changes
  useEffect(() => {
    sessionStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
} 