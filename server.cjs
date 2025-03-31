const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4243;

// Process map for managing running processes
const runningProcesses = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Constants
const TOOLS_FILE = path.join(__dirname, 'src/data/tools.json');

// Ensure proper MIME types for static files
const serveStatic = express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
});

// Serve static files from the 'dist' directory in production
app.use(serveStatic);

// API routes
// Get all tools
app.get('/api/tools', async (req, res) => {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const tools = JSON.parse(data);
    res.json(tools);
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(500).json({ error: 'Failed to read tools' });
  }
});

// Update tools
app.post('/api/tools', async (req, res) => {
  try {
    const { tools } = req.body;
    
    if (!tools || !Array.isArray(tools)) {
      return res.status(400).json({ error: 'Invalid tools data' });
    }

    // Read the current data
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const currentData = JSON.parse(data);
    
    // Update tools
    const updatedData = { ...currentData, tools };
    
    // Write updated data back to file
    await fs.writeFile(TOOLS_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    
    res.json({ success: true, message: 'Tools updated successfully' });
  } catch (error) {
    console.error('Error updating tools:', error);
    res.status(500).json({ error: 'Failed to update tools' });
  }
});

// API endpoint to run a tool
app.post('/api/tools/run', async (req, res) => {
  try {
    const { toolId, rootPath, command, envCommand } = req.body;
    
    if (!toolId || !rootPath || !command) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    
    // Construct the full command
    const fullCommand = envCommand 
      ? `cd "${rootPath}" && ${envCommand} && ${command}`
      : `cd "${rootPath}" && ${command}`;
    
    try {
      // Execute the command
      const process = exec(fullCommand, { windowsHide: true });
      
      // Store the process
      runningProcesses.set(toolId, process);
      
      // Handle stdout
      process.stdout.on('data', (data) => {
        console.log(`[Tool ${toolId}] stdout: ${data}`);
      });
      
      // Handle stderr
      process.stderr.on('data', (data) => {
        console.error(`[Tool ${toolId}] stderr: ${data}`);
      });
      
      // Handle process exit
      process.on('exit', (code) => {
        console.log(`[Tool ${toolId}] Process exited with code ${code}`);
        runningProcesses.delete(toolId);
        
        // Update the tools.json file to mark the app as not running
        updateToolRunningStatus(toolId, false);
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ success: true });
    } catch (execError) {
      console.error(`Error executing command: ${execError.message}`);
      res.status(500).json({ 
        success: false, 
        message: `Error executing command: ${execError.message}` 
      });
    }
  } catch (error) {
    console.error('Error running tool:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to stop a tool
app.post('/api/tools/stop', async (req, res) => {
  try {
    const { toolId } = req.body;
    
    if (!toolId) {
      return res.status(400).json({ success: false, message: 'Tool ID is required' });
    }
    
    const process = runningProcesses.get(toolId);
    if (!process) {
      return res.status(404).json({ success: false, message: 'No running process found for this tool' });
    }
    
    try {
      // Kill the process
      process.kill();
      runningProcesses.delete(toolId);
      
      // Update the tools.json file
      await updateToolRunningStatus(toolId, false);
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ success: true });
    } catch (killError) {
      console.error(`Error killing process: ${killError.message}`);
      res.status(500).json({ 
        success: false, 
        message: `Error killing process: ${killError.message}` 
      });
    }
  } catch (error) {
    console.error('Error stopping tool:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to update the tools.json file
async function updateToolRunningStatus(toolId, isRunning) {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const tools = JSON.parse(data);
    
    const updatedTools = {
      ...tools,
      tools: tools.tools.map(tool => 
        tool.id === toolId 
          ? { ...tool, execution: { ...tool.execution, isRunning } }
          : tool
      )
    };
    
    await fs.writeFile(TOOLS_FILE, JSON.stringify(updatedTools, null, 2), 'utf8');
  } catch (error) {
    console.error('Error updating tools file:', error);
  }
}

// For any other request, serve the index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Production server running at http://localhost:${PORT}`);
  console.log(`Serving static files from 'dist' directory`);
  console.log(`API endpoints available at:`);
  console.log(`  GET /api/tools - Get all tools`);
  console.log(`  POST /api/tools - Update tools`);
  console.log(`  POST /api/tools/run - Run a tool`);
  console.log(`  POST /api/tools/stop - Stop a tool`);
}); 