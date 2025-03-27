import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTools } from '../hooks/useTools';

// Use the same base URL as in other files
const API_BASE_URL = 'http://localhost:3015';
const WS_BASE_URL = 'ws://localhost:3015';

export const TerminalContext = createContext();

// ANSI code parser for terminal colors
const parseAnsiString = (str) => {
  // Replace ANSI color codes with span classes
  return str
    .replace(/\u001b\[32m\u001b\[1m(.*?)\u001b\[22m\u001b\[39m/g, '<span class="text-green-500 font-bold">$1</span>')
    .replace(/\u001b\[31m\u001b\[1m(.*?)\u001b\[22m\u001b\[39m/g, '<span class="text-red-500 font-bold">$1</span>')
    .replace(/\u001b\[33m\u001b\[1m(.*?)\u001b\[22m\u001b\[39m/g, '<span class="text-yellow-500 font-bold">$1</span>')
    .replace(/\u001b\[1m(.*?)\u001b\[22m/g, '<span class="font-bold">$1</span>')
    .replace(/\u001b\[32m(.*?)\u001b\[39m/g, '<span class="text-green-500">$1</span>')
    .replace(/\u001b\[31m(.*?)\u001b\[39m/g, '<span class="text-red-500">$1</span>')
    .replace(/\u001b\[33m(.*?)\u001b\[39m/g, '<span class="text-yellow-500">$1</span>');
};

export function TerminalProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState(null);
  const [activeToolName, setActiveToolName] = useState('');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const { tools, updateToolRunningStatus } = useTools();
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const reconnectCountRef = useRef(0);

  // Function to initialize WebSocket connection
  const initWebSocket = useCallback(() => {
    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
      reconnectCountRef.current = 0;
      
      // Clear any existing reconnect interval
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      
      // Set up ping interval to keep connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000); // Send ping every 15 seconds
      
      // If we have an active tool, subscribe to its output
      if (activeToolId) {
        console.log(`Re-subscribing to tool ${activeToolId}`);
        subscribeToToolOutput(activeToolId);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket connection closed', event);
      setIsConnected(false);
      
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Attempt to reconnect
      if (!reconnectIntervalRef.current) {
        reconnectIntervalRef.current = setInterval(() => {
          if (reconnectCountRef.current < 5) {
            console.log('Attempting to reconnect WebSocket...');
            reconnectCountRef.current++;
            initWebSocket();
          } else {
            console.log('Max reconnection attempts reached');
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
        }, 5000); // Try to reconnect every 5 seconds
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        console.log('WebSocket message received:', event.data);
        const message = JSON.parse(event.data);
        
        if (message.type === 'connected') {
          console.log('Connection confirmed by server');
        } else if (message.type === 'process-output' && message.toolId === activeToolId) {
          console.log(`Process output received for tool ${message.toolId}:`, message.data);
          
          // Format output based on type
          let formattedData = message.data;
          
          // For command messages, prefix with $
          if (message.outputType === 'command' && !formattedData.startsWith('$')) {
            formattedData = `$ ${formattedData}`;
          }
          
          // Parse ANSI color codes
          formattedData = parseAnsiString(formattedData);
          
          // Split by newlines and add each line to the output
          const lines = formattedData.split('\n')
            .filter(line => line.trim())
            .map(line => {
              // Add error/warning formatting for stderr
              if (message.outputType === 'stderr' || message.outputType === 'error') {
                return `<span class="text-red-500">Error: ${line}</span>`;
              }
              return line;
            });
          
          if (lines.length > 0) {
            console.log(`Adding ${lines.length} lines to terminal output`);
            setTerminalOutput(prev => [...prev, ...lines]);
          }
          
          // Check for app status changes
          const appStatus = detectAppStatus(message.data, message.outputType, message.toolId);
          if (appStatus) {
            updateToolStatus(message.toolId, appStatus);
          }
        } else if (message.type === 'info') {
          // Add info messages to the terminal
          console.log(`Info message received: ${message.message}`);
          setTerminalOutput(prev => [...prev, message.message]);
        } else if (message.type === 'pong') {
          // Server responded to our ping
          console.log('Received pong from server');
        } else {
          console.log(`Received message of type ${message.type}, current activeToolId: ${activeToolId}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return ws;
  }, [activeToolId, updateToolRunningStatus]);

  // Initialize WebSocket when component mounts
  useEffect(() => {
    const ws = initWebSocket();
    
    // Ping the server to check if it's available
    fetch(`${API_BASE_URL}/api/tools`)
      .then(response => {
        if (response.ok) {
          console.log('API server is available');
        } else {
          console.warn('API server returned an error:', response.status);
        }
      })
      .catch(error => {
        console.error('API server is not available:', error);
        setTerminalOutput([
          'Terminal Error: Cannot connect to the API server.',
          'Please make sure the server is running with "node server.js"'
        ]);
      });
    
    // Cleanup function
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [initWebSocket]);

  // Function to subscribe to a tool's output
  const subscribeToToolOutput = (toolId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(`Subscribing to tool output for tool ID: ${toolId}`);
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        toolId
      }));
    } else {
      console.log('WebSocket not connected, will subscribe when connection is established');
    }
  };

  // Update tool status in the tools context
  const updateToolStatus = (toolId, status) => {
    // Only update the running status after we detect the app is actually ready
    if (status === 'running') {
      console.log(`Updating tool ${toolId} to running status`);
      updateToolRunningStatus(toolId, true);
    } else if (status === 'stopped') {
      console.log(`Updating tool ${toolId} to stopped status`);
      updateToolRunningStatus(toolId, false);
    }
  };

  // Process message data to detect app status
  const detectAppStatus = (data, outputType, toolId) => {
    if (!data) return null;

    // Only look for ready indicators in stdout, not in stderr or command output
    if (outputType === 'stdout') {
      // Regular expressions to detect when the app is ready
      const readyPatterns = [
        /ready in \d+m?s/i,
        /ready in/i,
        /started.*on port/i,
        /started server/i,
        /listening on/i,
        /running at/i,
        /available at/i,
        /available on/i,
        /server.*started/i,
        /server.*ready/i,
        /http:\/\/localhost:\d+/
      ];

      // Check each pattern
      for (const pattern of readyPatterns) {
        if (pattern.test(data)) {
          console.log(`App ready pattern detected: ${pattern}`);
          return 'running';
        }
      }
    } 
    
    // Check for exit or termination messages
    if (outputType === 'exit' || data.includes('terminated by user')) {
      return 'stopped';
    }

    return null;
  };

  // Open terminal for a specific tool
  const openTerminalForTool = (toolId) => {
    if (!toolId) return;
    
    // Find tool name
    const tool = tools.find(t => t.id === toolId);
    const toolName = tool ? tool.name : 'Unknown Tool';
    
    console.log(`Opening terminal for tool ${toolId} (${toolName})`);
    
    setActiveToolId(toolId);
    setActiveToolName(toolName);
    setTerminalOutput([`$ Starting process for ${toolName}...`]);
    setIsTerminalOpen(true);
    
    // Subscribe to this tool's output
    if (isConnected) {
      subscribeToToolOutput(toolId);
    } else {
      // If not connected, add a message indicating we're waiting for connection
      setTerminalOutput(prev => [
        ...prev,
        'Waiting for WebSocket connection to establish...'
      ]);
    }
  };
  
  // Close the terminal
  const closeTerminal = () => {
    setIsTerminalOpen(false);
    setActiveToolId(null);
    setTerminalOutput([]);
  };
  
  // Clear terminal output
  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  // Listen for custom event to open terminal
  useEffect(() => {
    const handleOpenTerminal = (event) => {
      if (event.detail && event.detail.toolId) {
        openTerminalForTool(event.detail.toolId);
      }
    };
    
    window.addEventListener('open-terminal', handleOpenTerminal);
    
    return () => {
      window.removeEventListener('open-terminal', handleOpenTerminal);
    };
  }, [tools]); // Re-add event listener if tools change

  return (
    <TerminalContext.Provider
      value={{
        isTerminalOpen,
        activeToolId,
        activeToolName,
        terminalOutput,
        isConnected,
        openTerminalForTool,
        closeTerminal,
        clearTerminal
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

// Custom hook for using the terminal context
export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
} 