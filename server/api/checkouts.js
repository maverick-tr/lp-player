import { promises as fs } from 'fs';
import path from 'path';

const CHECKOUTS_FILE = path.join(process.cwd(), 'data', 'checkouts.json');

// Ensure the checkouts file exists
async function ensureCheckoutsFile() {
  try {
    await fs.access(CHECKOUTS_FILE);
  } catch {
    const initialData = JSON.stringify({}, null, 2);
    await fs.writeFile(CHECKOUTS_FILE, initialData, 'utf8');
    console.log('Created new checkouts file');
  }
}

export async function getCheckouts(req, res) {
  try {
    await ensureCheckoutsFile();
    const data = await fs.readFile(CHECKOUTS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error in getCheckouts:', error);
    res.status(500).json({ error: 'Failed to get checkouts', details: error.message });
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