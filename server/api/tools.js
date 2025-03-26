import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS_FILE = path.join(__dirname, '../../src/data/tools.json');

/**
 * Get all tools
 */
export const getTools = async (req, res) => {
  try {
    const data = await fs.readFile(TOOLS_FILE, 'utf8');
    const tools = JSON.parse(data);
    res.json(tools);
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(500).json({ error: 'Failed to read tools' });
  }
};

/**
 * Update tools
 */
export const updateTools = async (req, res) => {
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
}; 