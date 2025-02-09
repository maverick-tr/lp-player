import express from 'express';
import pkg from 'ping';
const { promise: pingPromise } = pkg;
import cors from 'cors';
import { getCheckouts, updateCheckout } from './api/checkouts.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

console.log('Starting server...');

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
try {
  await fs.access(dataDir);
} catch {
  await fs.mkdir(dataDir);
}

app.get('/api/ping/:ip', async (req, res) => {
  console.log(`Received ping request for IP: ${req.params.ip}`);
  res.json({ isAlive: true, time: 100 }); // Let's start with a simple response first
});

// Add this route to test if the server is responding at all
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Add these routes
app.get('/api/checkouts', getCheckouts);
app.post('/api/checkouts', updateCheckout);

// Serve index.html for all other routes (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Production server running at http://localhost:${PORT}`);
});

// Add error handling
app.on('error', (error) => {
  console.error('Server error:', error);
}); 