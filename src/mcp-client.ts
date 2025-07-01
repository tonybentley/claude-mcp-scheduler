import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPError } from './types/errors.js';
import { MCPTool, MCPToolCall, MCPToolResult } from './types/mcp.js';
import { createChildLogger } from './logger.js';
import { MCPFilesystemConfig } from './types/config.js';

const logger = createChildLogger('mcp-client');

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: ChildProcess | null = null;
  private tools: Map<string, MCPTool> = new Map();
  private isConnected = false;

  constructor(private config: MCPFilesystemConfig) {}

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('MCP client already connected');
      return;
    }

    try {
      logger.info('Starting MCP server', {
        command: this.config.command,
        args: this.config.args
      });

      // Spawn the MCP server process
      this.serverProcess = spawn(this.config.command, this.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_ALLOWED_DIRECTORIES: this.config.allowedDirectories.join(',')
        }
      });

      this.serverProcess.on('error', (error) => {
        logger.error('MCP server process error', { error: error.message });
        throw new MCPError('Failed to start MCP server', { error: error.message });
      });

      this.serverProcess.stderr?.on('data', (data: Buffer) => {
        logger.debug('MCP server stderr', { data: data.toString() });
      });

      // Create transport and client
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: {
          ...process.env,
          MCP_ALLOWED_DIRECTORIES: this.config.allowedDirectories.join(',')
        }
      });

      this.client = new Client({
        name: 'claude-mcp-scheduler',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect the client
      await this.client.connect(this.transport);
      this.isConnected = true;

      // Discover available tools
      await this.discoverTools();

      logger.info('MCP client connected successfully', {
        toolsCount: this.tools.size
      });
    } catch (error) {
      await this.disconnect();
      throw new MCPError('Failed to connect to MCP server', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnecting MCP client');

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        logger.error('Error closing MCP client', { error });
      }
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        logger.error('Error closing transport', { error });
      }
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    this.client = null;
    this.transport = null;
    this.tools.clear();
    this.isConnected = false;
  }

  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new MCPError('Client not connected');
    }

    try {
      const response = await this.client.listTools();
      
      if (response.tools !== undefined) {
        for (const tool of response.tools) {
          this.tools.set(tool.name, {
            name: tool.name,
            description: tool.description ?? '',
            inputSchema: tool.inputSchema as MCPTool['inputSchema']
          });
          logger.debug('Discovered tool', { toolName: tool.name });
        }
      }
    } catch (error) {
      throw new MCPError('Failed to discover tools', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.client) {
      throw new MCPError('Client not connected');
    }

    const tool = this.tools.get(toolCall.toolName);
    if (!tool) {
      throw new MCPError(`Tool not found: ${toolCall.toolName}`, {
        availableTools: Array.from(this.tools.keys())
      });
    }

    try {
      logger.debug('Calling MCP tool', {
        toolName: toolCall.toolName,
        arguments: toolCall.arguments
      });

      const response = await this.client.callTool({
        name: toolCall.toolName,
        arguments: toolCall.arguments
      }) as { content: Array<{ type: string; text?: string; [key: string]: unknown }>; isError?: boolean };

      const result: MCPToolResult = {
        toolCallId: `${toolCall.toolName}-${Date.now()}`,
        content: response.content.map((item) => ({
          type: item.type,
          text: item.type === 'text' && typeof item.text === 'string' ? item.text : undefined,
          data: item.type !== 'text' ? item : undefined
        })),
        isError: response.isError
      };

      logger.debug('MCP tool call completed', {
        toolName: toolCall.toolName,
        isError: response.isError
      });

      return result;
    } catch (error) {
      logger.error('MCP tool call failed', {
        toolName: toolCall.toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new MCPError(`Tool call failed: ${toolCall.toolName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }
}