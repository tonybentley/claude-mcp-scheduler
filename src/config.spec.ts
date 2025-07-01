import { ConfigManager } from './config.js';
import { ConfigurationError, ValidationError } from './types/errors.js';
import { DEFAULT_CONFIG } from './types/config.js';
import * as fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
  
  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('loadConfig', () => {
    it('should load valid configuration from file', async () => {
      const validConfig = {
        schedules: [{
          name: 'test-schedule',
          cron: '0 * * * *',
          enabled: true,
          prompt: 'Test prompt'
        }],
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            allowedDirectories: ['./data']
          }
        },
        anthropic: {
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.7
        },
        logging: {
          level: 'info',
          file: 'logs/combined.log'
        }
      };

      mockReadFile.mockResolvedValue(JSON.stringify(validConfig));
      
      const config = await configManager.loadConfig();
      
      expect(config.schedules).toHaveLength(1);
      expect(config.schedules[0]?.name).toBe('test-schedule');
      expect(mockReadFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'config', 'config.json'),
        'utf-8'
      );
    });

    it('should use default config when file not found', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);
      
      const config = await configManager.loadConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should throw ConfigurationError for invalid JSON', async () => {
      mockReadFile.mockResolvedValue('{ invalid json }');
      
      await expect(configManager.loadConfig()).rejects.toThrow(ConfigurationError);
    });

    it('should merge partial config with defaults', async () => {
      const partialConfig = {
        schedules: [{
          name: 'test',
          cron: '* * * * *',
          enabled: true,
          prompt: 'Test'
        }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(partialConfig));
      
      const config = await configManager.loadConfig();
      
      expect(config.anthropic.model).toBe(DEFAULT_CONFIG.anthropic.model);
      expect(config.schedules).toHaveLength(1);
    });
  });

  describe('getConfig', () => {
    it('should throw error if config not loaded', () => {
      expect(() => configManager.getConfig()).toThrow(ConfigurationError);
    });

    it('should return loaded config', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(DEFAULT_CONFIG));
      
      await configManager.loadConfig();
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should throw error if ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      mockReadFile.mockResolvedValue(JSON.stringify(DEFAULT_CONFIG));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });

    it('should validate schedule names are unique', async () => {
      const configWithDuplicates = {
        ...DEFAULT_CONFIG,
        schedules: [
          { name: 'test', cron: '* * * * *', enabled: true, prompt: 'Test' },
          { name: 'test', cron: '* * * * *', enabled: true, prompt: 'Test' }
        ]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(configWithDuplicates));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });

    it('should validate schedule has required fields', async () => {
      const configWithInvalidSchedule = {
        ...DEFAULT_CONFIG,
        schedules: [
          { name: '', cron: '* * * * *', enabled: true, prompt: 'Test' }
        ]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(configWithInvalidSchedule));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });

    it('should validate output paths', async () => {
      const configWithInvalidPath = {
        ...DEFAULT_CONFIG,
        schedules: [{
          name: 'test',
          cron: '* * * * *',
          enabled: true,
          prompt: 'Test',
          outputPath: '../../../etc/passwd'
        }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(configWithInvalidPath));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });

    it('should validate MCP allowed directories', async () => {
      const configWithInvalidMCP = {
        ...DEFAULT_CONFIG,
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            allowedDirectories: ['/etc']
          }
        }
      };

      mockReadFile.mockResolvedValue(JSON.stringify(configWithInvalidMCP));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });

    it('should validate Anthropic config values', async () => {
      const configWithInvalidAnthropic = {
        ...DEFAULT_CONFIG,
        anthropic: {
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: -1,
          temperature: 0.7
        }
      };

      mockReadFile.mockResolvedValue(JSON.stringify(configWithInvalidAnthropic));
      
      await expect(configManager.loadConfig()).rejects.toThrow(ValidationError);
    });
  });
});