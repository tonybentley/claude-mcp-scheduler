import { readFile } from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { Config, DEFAULT_CONFIG, Schedule } from './types/config.js';
import { ConfigurationError, ValidationError } from './types/errors.js';
import { logger } from './logger.js';

dotenv.config();

const CONFIG_FILE_PATH = path.join(process.cwd(), 'config', 'config.json');

export class ConfigManager {
  private config: Config | null = null;

  async loadConfig(): Promise<Config> {
    try {
      const configData = await readFile(CONFIG_FILE_PATH, 'utf-8');
      const parsedConfig = JSON.parse(configData) as Partial<Config>;
      
      this.config = this.mergeWithDefaults(parsedConfig);
      this.validateConfig(this.config);
      
      logger.info('Configuration loaded successfully', {
        schedulesCount: this.config.schedules.length,
        configPath: CONFIG_FILE_PATH
      });
      
      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Config file not found, using defaults', { path: CONFIG_FILE_PATH });
        this.config = DEFAULT_CONFIG;
        this.validateConfig(this.config);
        return this.config;
      }
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof SyntaxError) {
        throw new ConfigurationError('Invalid JSON in config file', {
          path: CONFIG_FILE_PATH,
          error: error.message
        });
      }
      
      throw new ConfigurationError('Failed to load configuration', {
        path: CONFIG_FILE_PATH,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getConfig(): Config {
    if (this.config === null) {
      throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  private mergeWithDefaults(partial: Partial<Config>): Config {
    return {
      schedules: partial.schedules ?? DEFAULT_CONFIG.schedules,
      mcp: {
        filesystem: {
          ...DEFAULT_CONFIG.mcp.filesystem,
          ...partial.mcp?.filesystem
        }
      },
      anthropic: {
        ...DEFAULT_CONFIG.anthropic,
        ...partial.anthropic
      },
      logging: {
        ...DEFAULT_CONFIG.logging,
        ...partial.logging
      }
    };
  }

  private validateConfig(config: Config): void {
    this.validateApiKey();
    this.validateSchedules(config.schedules);
    this.validateMCPConfig(config.mcp);
    this.validateAnthropicConfig(config.anthropic);
  }

  private validateApiKey(): void {
    if (process.env.ANTHROPIC_API_KEY === undefined || process.env.ANTHROPIC_API_KEY === '') {
      throw new ValidationError('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  private validateSchedules(schedules: Schedule[]): void {
    const names = new Set<string>();
    
    schedules.forEach((schedule, index) => {
      if (!schedule.name || schedule.name.trim() === '') {
        throw new ValidationError(`Schedule at index ${index} must have a name`);
      }
      
      if (names.has(schedule.name)) {
        throw new ValidationError(`Duplicate schedule name: ${schedule.name}`);
      }
      names.add(schedule.name);
      
      if (!schedule.cron || schedule.cron.trim() === '') {
        throw new ValidationError(`Schedule '${schedule.name}' must have a cron expression`);
      }
      
      if (!schedule.prompt || schedule.prompt.trim() === '') {
        throw new ValidationError(`Schedule '${schedule.name}' must have a prompt`);
      }
      
      if (schedule.outputPath !== undefined && !this.isValidPath(schedule.outputPath)) {
        throw new ValidationError(`Invalid output path for schedule '${schedule.name}': ${schedule.outputPath}`);
      }
    });
  }

  private validateMCPConfig(mcp: Config['mcp']): void {
    if (!mcp.filesystem.command || mcp.filesystem.command.trim() === '') {
      throw new ValidationError('MCP filesystem command is required');
    }
    
    if (!Array.isArray(mcp.filesystem.allowedDirectories) || mcp.filesystem.allowedDirectories.length === 0) {
      throw new ValidationError('At least one allowed directory must be specified for MCP');
    }
    
    mcp.filesystem.allowedDirectories.forEach(dir => {
      if (!this.isValidPath(dir)) {
        throw new ValidationError(`Invalid allowed directory: ${dir}`);
      }
    });
  }

  private validateAnthropicConfig(anthropic: Config['anthropic']): void {
    if (!anthropic.model || anthropic.model.trim() === '') {
      throw new ValidationError('Anthropic model is required');
    }
    
    if (anthropic.maxTokens <= 0 || anthropic.maxTokens > 100000) {
      throw new ValidationError('Max tokens must be between 1 and 100000');
    }
    
    if (anthropic.temperature < 0 || anthropic.temperature > 2) {
      throw new ValidationError('Temperature must be between 0 and 2');
    }
  }

  private isValidPath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    return !normalizedPath.includes('..') && !path.isAbsolute(normalizedPath);
  }
}

export const configManager = new ConfigManager();