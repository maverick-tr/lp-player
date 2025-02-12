import { createContext, useContext, useState, useEffect } from 'react';
import toolsData from '../data/tools.json';

const ToolContext = createContext();

export function ToolProvider({ children }) {
  const [tools] = useState(toolsData.tools);
  const [filteredTools, setFilteredTools] = useState(tools);
  const [checkouts, setCheckouts] = useState({});

  // Fetch initial checkouts
  useEffect(() => {
    fetchCheckouts();
  }, []);

  const fetchCheckouts = async () => {
    try {
      // Use relative URL in both development and production.
      const baseUrl = ''; 
      const response = await fetch(`${baseUrl}/api/checkouts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCheckouts(data);
    } catch (error) {
      console.error('Failed to fetch checkouts:', error);
      // Initialize with empty checkouts rather than failing
      setCheckouts({});
    }
  };

  const checkoutTool = async (toolId, initials) => {
    const tool = tools.find(t => t.id === toolId);
    const currentCheckouts = checkouts[toolId] || [];
    
    if (currentCheckouts.length >= tool.maxCheckouts) {
      throw new Error('Maximum checkouts reached');
    }

    try {
      const baseUrl = '';  // Use relative URL
      const response = await fetch(`${baseUrl}/api/checkouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, action: 'checkout', initials })
      });
      
      const updatedCheckouts = await response.json();
      setCheckouts(updatedCheckouts);
    } catch (error) {
      console.error('Failed to checkout tool:', error);
      throw error;
    }
  };

  const checkinTool = async (toolId, initials) => {
    try {
      const baseUrl = '';  // Use relative URL
      const response = await fetch(`${baseUrl}/api/checkouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, action: 'checkin', initials })
      });
      
      const updatedCheckouts = await response.json();
      setCheckouts(updatedCheckouts);
    } catch (error) {
      console.error('Failed to checkin tool:', error);
      throw error;
    }
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