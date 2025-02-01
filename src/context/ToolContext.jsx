import { createContext, useContext, useState, useEffect } from 'react';
import toolsData from '../data/tools.json';

const ToolContext = createContext();

export function ToolProvider({ children }) {
  const [tools] = useState(toolsData.tools);
  const [filteredTools, setFilteredTools] = useState(tools);
  const [checkouts, setCheckouts] = useState(() => {
    const saved = localStorage.getItem('toolCheckouts');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('toolCheckouts', JSON.stringify(checkouts));
  }, [checkouts]);

  const checkoutTool = (toolId, initials) => {
    const tool = tools.find(t => t.id === toolId);
    const currentCheckouts = checkouts[toolId] || [];
    
    if (currentCheckouts.length >= tool.maxCheckouts) {
      throw new Error('Maximum checkouts reached');
    }

    setCheckouts(prev => ({
      ...prev,
      [toolId]: [...(prev[toolId] || []), { initials, timestamp: new Date().toISOString() }]
    }));
  };

  const checkinTool = (toolId, initials) => {
    setCheckouts(prev => ({
      ...prev,
      [toolId]: (prev[toolId] || []).filter(checkout => checkout.initials !== initials)
    }));
  };

  return (
    <ToolContext.Provider value={{ 
      tools, 
      filteredTools, 
      setFilteredTools,
      checkouts, 
      checkoutTool, 
      checkinTool 
    }}>
      {children}
    </ToolContext.Provider>
  );
}

export function useTools() {
  return useContext(ToolContext);
} 