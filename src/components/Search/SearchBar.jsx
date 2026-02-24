import { useState, useEffect, useCallback, memo } from 'react';
import { useTools } from '../../hooks/useTools';
import { useTheme } from '../../hooks/useTheme';
import { motion } from 'framer-motion';

// Debounce function to reduce search renders
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// Use memo to prevent unnecessary re-renders
const SearchBar = memo(function SearchBar() {
  const { filterTools } = useTools();
  const { isDarkMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Debounce search input to reduce render frequency
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Use the filterTools callback from context with debounced value
  useEffect(() => {
    filterTools(debouncedSearchTerm);
  }, [debouncedSearchTerm, filterTools]);
  
  // Memoize the change handler
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  return (
    <motion.div 
      className="relative max-w-2xl mx-auto mb-8"
      animate={{ 
        width: isFocused ? "100%" : "80%",
        scale: isFocused ? 1 : 0.98
      }}
      transition={{ duration: 0.2 }}
    >
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Search projects by name, URL, or tags..."
        className={`
          w-full px-4 py-3 pl-12
          rounded-xl
          transition-all duration-200
          outline-none
          ${isDarkMode 
            ? 'bg-tool-light text-white border-2 border-[#bccc0f]/30 focus:border-[#bccc0f] focus:shadow-[0_0_15px_rgba(188,204,15,0.3)]' 
            : 'bg-white text-gray-800 border-2 border-[#bccc0f]/20 focus:border-[#bccc0f] focus:shadow-[0_0_15px_rgba(188,204,15,0.2)]'
          }
        `}
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg 
          className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
      </div>
    </motion.div>
  );
});

export default SearchBar; 