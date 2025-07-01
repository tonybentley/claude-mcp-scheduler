export interface Schedule {
  name: string;
  cron: string;
  enabled: boolean;
  prompt: string;
  outputPath?: string;
}

export interface MCPFilesystemConfig {
  command: string;
  args: string[];
  allowedDirectories: string[];
}

export interface MCPConfig {
  filesystem: MCPFilesystemConfig;
}

export interface AnthropicConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LoggingConfig {
  level: string;
  file: string;
}

export interface Config {
  schedules: Schedule[];
  mcp: MCPConfig;
  anthropic: AnthropicConfig;
  logging: LoggingConfig;
}

export const DEFAULT_CONFIG: Config = {
  schedules: [],
  mcp: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      allowedDirectories: ['./data', './reports']
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