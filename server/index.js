import express from 'express';
import pkg from 'ping';
const { promise: pingPromise } = pkg;
import cors from 'cors';

const app = express();

console.log('Starting server...');

// Enable CORS if needed
app.use(cors());

app.get('/api/ping/:ip', async (req, res) => {
  console.log(`Received ping request for IP: ${req.params.ip}`);
  res.json({ isAlive: true, time: 100 }); // Let's start with a simple response first
});

// Add this route to test if the server is responding at all
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Add error handling
app.on('error', (error) => {
  console.error('Server error:', error);
}); 