/**
 * Installer Service - Coordinates Git-based project installation workflow
 */
import { executeProcess } from '../utils/processExecutor';

class InstallerService {
  constructor(toolContext) {
    this.toolContext = toolContext;
    this.currentInstallation = null;
  }

  /**
   * Install project from Git repository
   * @param {string} repoUrl - Git repository URL
   * @param {string} targetPath - Destination directory
   * @param {function} onProgress - Progress callback
   * @returns {Promise<Object>} Installation result
   */
  async installFromGit(repoUrl, targetPath, onProgress) {
    try {
      this.currentInstallation = {
        repoUrl,
        targetPath,
        status: 'cloning',
        error: null
      };
      onProgress(this.currentInstallation);

      // 1. Clone repository
      await this.cloneRepository(repoUrl, targetPath, onProgress);

      // 2. Parse README
      const readmeData = await this.parseReadme(targetPath, onProgress);

      // 3. Generate installation plan
      const installationPlan = this.generatePlan(readmeData, onProgress);

      // 4. Execute installation
      const executionResult = await this.executeInstallation(
        targetPath, 
        installationPlan, 
        onProgress
      );

      // 5. Register project
      const registeredTool = await this.registerProject(
        targetPath,
        installationPlan,
        executionResult,
        onProgress
      );

      return {
        success: true,
        tool: registeredTool
      };
    } catch (error) {
      this.currentInstallation.status = 'failed';
      this.currentInstallation.error = error.message;
      onProgress(this.currentInstallation);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.currentInstallation = null;
    }
  }

  async cloneRepository(repoUrl, targetPath, onProgress) {
    this.currentInstallation.status = 'cloning';
    onProgress(this.currentInstallation);

    try {
      await executeProcess(
        'git-clone',
        process.cwd(),
        `git clone ${repoUrl} ${targetPath}`,
        ''
      );
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async parseReadme(repoPath, onProgress) {
    this.currentInstallation.status = 'parsing';
    onProgress(this.currentInstallation);

    try {
      // TODO: README parsing requires server-side API (fs access)
      // For now, return minimal structure so installation can proceed
      const readmeData = {
        commands: ['npm install'],
        packageManager: 'npm',
        dependencies: [],
        estimatedTime: '1-2 minutes'
      };
      this.currentInstallation.readmeData = readmeData;
      onProgress(this.currentInstallation);
      return readmeData;
    } catch (error) {
      throw new Error(`README parsing failed: ${error.message}`);
    }
  }

  generatePlan(readmeData, onProgress) {
    this.currentInstallation.status = 'planning';
    onProgress(this.currentInstallation);

    // Validate commands using basic safety check (ReadmeParser is server-side only)
    const unsafePatterns = [/rm\s+-rf/, /sudo/, /mkfs/, /dd\s+if=/, />\s*\/dev\//];
    const validatedCommands = readmeData.commands.filter(cmd =>
      !unsafePatterns.some(pattern => pattern.test(cmd))
    );

    if (!validatedCommands.length) {
      throw new Error('No valid installation commands found in README');
    }

    const plan = {
      packageManager: readmeData.packageManager,
      commands: validatedCommands,
      dependencies: readmeData.dependencies,
      estimatedTime: readmeData.estimatedTime
    };

    this.currentInstallation.plan = plan;
    onProgress(this.currentInstallation);
    return plan;
  }

  async executeInstallation(repoPath, plan, onProgress) {
    this.currentInstallation.status = 'installing';
    onProgress(this.currentInstallation);

    try {
      const results = [];
      for (const cmd of plan.commands) {
        this.currentInstallation.currentCommand = cmd;
        onProgress(this.currentInstallation);

        const result = await executeProcess(
          'installer',
          repoPath,
          cmd,
          ''
        );
        results.push(result);
      }
      return results;
    } catch (error) {
      throw new Error(`Installation failed: ${error.message}`);
    }
  }

  async registerProject(repoPath, plan, executionResult, onProgress) {
    this.currentInstallation.status = 'registering';
    onProgress(this.currentInstallation);

    try {
      const repoName = repoPath.split('/').pop();
      const toolData = {
        name: repoName,
        description: `Installed from Git: ${repoName}`,
        category: 'application',
        execution: {
          rootPath: repoPath,
          command: plan.commands[0], // Use first command as default run command
          isRunning: false
        },
        metadata: {
          installedFromGit: true,
          dependencies: plan.dependencies,
          installationTime: new Date().toISOString()
        }
      };

      const success = await this.toolContext.addApp(toolData);
      if (!success) {
        throw new Error('Failed to register project');
      }

      this.currentInstallation.status = 'completed';
      onProgress(this.currentInstallation);

      return toolData;
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  getCurrentInstallation() {
    return this.currentInstallation;
  }

  cancelInstallation() {
    if (this.currentInstallation) {
      this.currentInstallation.status = 'cancelled';
      return true;
    }
    return false;
  }
}

export default InstallerService;