import { createContext, useState, useEffect, useCallback } from 'react';

// Export the context directly
export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize with session preference or default to dark
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = sessionStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });
  // Initialize sepia value from sessionStorage or default to 40
  const [sepiaValue, setSepiaStateValue] = useState(() => {
    const savedSepia = sessionStorage.getItem('sepia');
    return savedSepia ? parseInt(savedSepia, 10) : 40; // Default sepia is 40%
  });
  // Initialize hue value from sessionStorage or default to 0
  const [hueValue, setHueStateValue] = useState(() => {
    const savedHue = sessionStorage.getItem('hue');
    return savedHue ? parseInt(savedHue, 10) : 0; // Default hue is 0 degrees
  });

  // Save to sessionStorage whenever theme, sepia, or hue changes
  useEffect(() => {
    sessionStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    sessionStorage.setItem('sepia', sepiaValue.toString());
    sessionStorage.setItem('hue', hueValue.toString());
  }, [isDarkMode, sepiaValue, hueValue]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Renamed state setter to avoid conflict, provide a stable setter function
  const setSepiaValue = useCallback((value) => {
    const numValue = typeof value === 'function' ? value(sepiaValue) : value;
    setSepiaStateValue(Math.max(0, Math.min(100, numValue))); // Clamp between 0 and 100
  }, [sepiaValue]);

  // Add hue setter
  const setHueValue = useCallback((value) => {
    const numValue = typeof value === 'function' ? value(hueValue) : value;
    setHueStateValue(Math.max(0, Math.min(360, numValue))); // Clamp between 0 and 360
  }, [hueValue]);

  return (
    <ThemeContext.Provider value={{
      isDarkMode, 
      toggleTheme, 
      sepiaValue, 
      setSepiaValue, 
      hueValue, // Expose hue state
      setHueValue // Expose hue setter
    }}>
      {children}
    </ThemeContext.Provider>
  );
} 