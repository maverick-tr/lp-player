/**
 * README Parser Service
 * Extracts installation instructions from README.md files
 */

const fs = require('fs');
const path = require('path');

// Supported package managers and their detection patterns
const PACKAGE_MANAGERS = {
  npm: /npm install|npm i|npm ci|yarn add|yarn install/,
  pip: /pip install|pip3 install|python -m pip install/,
  make: /make install|make build/,
  brew: /brew install/,
  apt: /apt-get install|apt install/,
  cargo: /cargo install/,
  go: /go install|go get/
};

class ReadmeParser {
  /**
   * Parse README file and extract installation instructions
   * @param {string} repoPath - Path to repository
   * @returns {Promise<Object>} Structured installation plan
   */
  static async parse(repoPath) {
    try {
      const readmePath = await this.findReadme(repoPath);
      if (!readmePath) {
        throw new Error('No README file found in repository');
      }

      const content = await fs.promises.readFile(readmePath, 'utf-8');
      const normalized = this.normalizeContent(content);
      const instructions = this.extractInstructions(normalized);

      if (!instructions.length) {
        throw new Error('No installation instructions found in README');
      }

      return {
        packageManager: this.detectPackageManager(instructions),
        commands: instructions,
        dependencies: this.extractDependencies(instructions),
        estimatedTime: this.estimateExecutionTime(instructions),
        readmePath
      };
    } catch (error) {
      throw new Error(`README parsing failed: ${error.message}`);
    }
  }

  /**
   * Find README file in repository (case-insensitive)
   * @param {string} repoPath - Path to repository
   * @returns {Promise<string|null>} Path to README or null if not found
   */
  static async findReadme(repoPath) {
    const files = await fs.promises.readdir(repoPath);
    const readmeFile = files.find(file => 
      file.toLowerCase().startsWith('readme') && 
      file.toLowerCase().endsWith('.md')
    );
    return readmeFile ? path.join(repoPath, readmeFile) : null;
  }

  /**
   * Normalize markdown content for parsing
   * @param {string} content - Raw README content
   * @returns {string} Normalized content
   */
  static normalizeContent(content) {
    // Remove code block markers but keep content
    return content
      .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\r\n/g, '\n');
  }

  /**
   * Extract installation instructions from content
   * @param {string} content - Normalized README content
   * @returns {Array<string>} Array of installation commands
   */
  static extractInstructions(content) {
    const lines = content.split('\n');
    const instructionLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return lowerLine.includes('install') || 
             lowerLine.includes('setup') || 
             lowerLine.includes('build');
    });

    // Extract commands from lines (e.g., code blocks or after headings)
    return instructionLines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }

  /**
   * Detect package manager from instructions
   * @param {Array<string>} instructions - Extracted commands
   * @returns {string} Detected package manager or 'unknown'
   */
  static detectPackageManager(instructions) {
    for (const [manager, pattern] of Object.entries(PACKAGE_MANAGERS)) {
      if (instructions.some(cmd => pattern.test(cmd))) {
        return manager;
      }
    }
    return 'unknown';
  }

  /**
   * Extract dependencies from instructions
   * @param {Array<string>} instructions - Extracted commands
   * @returns {Array<string>} List of dependencies
   */
  static extractDependencies(instructions) {
    const deps = new Set();
    instructions.forEach(cmd => {
      // Match package names in common install commands
      const matches = cmd.match(/(npm|pip|brew|apt) install ([^\s]+)/) ||
                     cmd.match(/(yarn|go) add ([^\s]+)/);
      if (matches && matches[2]) {
        matches[2].split(' ').forEach(dep => {
          if (dep && !dep.startsWith('-')) {
            deps.add(dep);
          }
        });
      }
    });
    return Array.from(deps);
  }

  /**
   * Estimate execution time based on commands
   * @param {Array<string>} instructions - Extracted commands
   * @returns {string} Estimated time ('fast', 'medium', 'slow')
   */
  static estimateExecutionTime(instructions) {
    const totalCommands = instructions.length;
    const hasComplexCommands = instructions.some(cmd => 
      cmd.includes('build') || cmd.includes('compile')
    );

    if (totalCommands > 5 || hasComplexCommands) return 'slow';
    if (totalCommands > 2) return 'medium';
    return 'fast';
  }

  /**
   * Validate extracted commands
   * @param {string} command - Command to validate
   * @returns {boolean} True if command appears safe to execute
   */
  static validateCommand(command) {
    const unsafePatterns = [
      /rm -rf/,
      /chmod/,
      /wget.*\|/,
      /curl.*\|/,
      /&&\s*[^&]/
    ];
    return !unsafePatterns.some(pattern => pattern.test(command));
  }
}

module.exports = ReadmeParser;