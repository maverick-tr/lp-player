// Process executor utility through server API

// Define the API base URL - adjust this to match your actual server URL
const API_BASE_URL = `http://${window.location.hostname}:3015`;

/**
 * Execute a command in a given directory with optional environment setup
 * @param {string} toolId - The ID of the tool being executed
 * @param {string} rootPath - The directory to execute the command in
 * @param {string} command - The command to execute
 * @param {string} envCommand - Optional environment activation command
 * @returns {Promise<Object>} - Result of the execution
 */
export const executeProcess = async (toolId, rootPath, command, envCommand = '') => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tools/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolId,
        rootPath,
        command,
        envCommand
      }),
    });

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with error (${response.status}): ${errorText}`);
    }
    
    // Try to parse JSON response, with error handling
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse server response as JSON:', parseError);
      // If we can't parse JSON but the response was OK, consider it a success
      // This handles cases where the server might send non-JSON responses
      return { success: true };
    }
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to run the tool');
    }
    
    return result;
  } catch (error) {
    console.error('Process execution error:', error);
    throw error;
  }
};

/**
 * Kill a running process for a tool
 * @param {string} toolId - The ID of the tool to stop
 * @returns {Promise<boolean>} - Whether the process was successfully killed
 */
export const killProcess = async (toolId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tools/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toolId }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error(`Failed to kill process for tool ID ${toolId}: ${error.message}`);
    return false;
  }
};

/**
 * Open the URL in the default browser
 * @param {string} url - The URL to open
 */
export const openInBrowser = (url) => {
  // For security, validate the URL before opening
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('Invalid URL format. Must start with http:// or https://');
    return;
  }
  
  // On the client side, we can use window.open for the browser
  window.open(url, '_blank');
}; 