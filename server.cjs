const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3015;

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
}); 