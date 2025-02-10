import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update path to point to server/data instead of project root/data
const CHECKOUTS_FILE = path.join(__dirname, '..', 'data', 'checkouts.json');

// Improve the ensureCheckoutsFile function with correct path
async function ensureCheckoutsFile() {
  try {
    // First ensure the data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
      console.log('Created data directory at:', dataDir);
    }

    // Then check for the file
    try {
      await fs.access(CHECKOUTS_FILE);
    } catch {
      const initialData = JSON.stringify({}, null, 2);
      await fs.writeFile(CHECKOUTS_FILE, initialData, 'utf8');
      console.log('Created new checkouts file at:', CHECKOUTS_FILE);
    }
  } catch (error) {
    console.error('Error in ensureCheckoutsFile:', error);
    throw error;
  }
}

export async function getCheckouts(req, res) {
  try {
    await ensureCheckoutsFile();
    const data = await fs.readFile(CHECKOUTS_FILE, 'utf8');
    
    // Add validation to ensure we're sending valid JSON
    try {
      const parsedData = JSON.parse(data);
      res.json(parsedData);
    } catch (parseError) {
      console.error('Invalid JSON in checkouts file:', parseError);
      // Reset the file if it's corrupted
      await fs.writeFile(CHECKOUTS_FILE, JSON.stringify({}, null, 2), 'utf8');
      res.json({});
    }
  } catch (error) {
    console.error('Error in getCheckouts:', error);
    res.status(500).json({ 
      error: 'Failed to get checkouts', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

export async function updateCheckout(req, res) {
  try {
    const { toolId, action, initials } = req.body;
    
    if (!toolId || !action || !initials) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: { toolId, action, initials }
      });
    }
    
    await ensureCheckoutsFile();
    const data = await fs.readFile(CHECKOUTS_FILE, 'utf8');
    const checkouts = JSON.parse(data);
    
    if (action === 'checkout') {
      checkouts[toolId] = [...(checkouts[toolId] || []), 
        { initials, timestamp: new Date().toISOString() }
      ];
    } else if (action === 'checkin') {
      checkouts[toolId] = (checkouts[toolId] || [])
        .filter(checkout => checkout.initials !== initials);
    } else {
      return res.status(400).json({ error: 'Invalid action', action });
    }
    
    await fs.writeFile(CHECKOUTS_FILE, JSON.stringify(checkouts, null, 2));
    res.json(checkouts);
  } catch (error) {
    console.error('Error in updateCheckout:', error);
    res.status(500).json({ error: 'Failed to update checkout', details: error.message });
  }
} 