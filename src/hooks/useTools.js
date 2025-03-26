import { useContext } from 'react';
import { ToolContext } from '../context/ToolContext';

// Separated hook to avoid Fast Refresh issues
export function useTools() {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useTools must be used within a ToolProvider');
  }
  return context;
} 