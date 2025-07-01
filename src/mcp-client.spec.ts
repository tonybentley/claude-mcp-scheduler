/* eslint-disable @typescript-eslint/unbound-method */
import { MCPClient } from './mcp-client.js';
import { MCPError } from './types/errors.js';
import { MCPFilesystemConfig } from './types/config.js';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { EventEmitter } from 'events';

jest.mock('child_process');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');

describe('MCPClient', () => {
  let mcpClient: MCPClient;
  let mockSpawn: jest.MockedFunction<typeof spawn>;
  let mockClient: jest.Mocked<Client>;
  let mockTransport: jest.Mocked<StdioClientTransport>;

  const testConfig: MCPFilesystemConfig = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    allowedDirectories: ['./data', './reports']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest.fn()
    } as unknown as jest.Mocked<Client>;
    
    mockTransport = {
      close: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<StdioClientTransport>;

    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
    (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport);

    mcpClient = new MCPClient(testConfig);
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object' as const,
              properties: { path: { type: 'string' } },
              required: ['path']
            }
          }
        ]
      });

      await mcpClient.connect();

      expect(mockSpawn).toHaveBeenCalledWith(
        testConfig.command,
        testConfig.args,
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.listTools).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(mcpClient.connect()).rejects.toThrow(MCPError);
    });

    it('should not reconnect if already connected', async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      await mcpClient.connect();
      await mcpClient.connect();

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      await mcpClient.connect();
      await mcpClient.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
      expect(mockTransport.close).toHaveBeenCalled();
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockClient.close.mockRejectedValue(new Error('Close failed'));

      await expect(mcpClient.disconnect()).resolves.not.toThrow();
    });
  });

  describe('getAvailableTools', () => {
    it('should return discovered tools', async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      const mockTools = [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: {
            type: 'object' as const,
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write a file',
          inputSchema: {
            type: 'object' as const,
            properties: { 
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await mcpClient.connect();
      const tools = mcpClient.getAvailableTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]?.name).toBe('read_file');
      expect(tools[1]?.name).toBe('write_file');
    });

    it('should return empty array when no tools discovered', () => {
      const tools = mcpClient.getAvailableTools();
      expect(tools).toEqual([]);
    });
  });

  describe('callTool', () => {
    beforeEach(async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      mockClient.listTools.mockResolvedValue({
        tools: [{
          name: 'read_file',
          description: 'Read a file',
          inputSchema: {
            type: 'object' as const,
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        }]
      });

      await mcpClient.connect();
    });

    it('should call tool successfully', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'File content' }],
        isError: false
      };

      mockClient.callTool.mockResolvedValue(mockResponse);

      const result = await mcpClient.callTool({
        toolName: 'read_file',
        arguments: { path: './test.txt' }
      });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'read_file',
        arguments: { path: './test.txt' }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toBe('File content');
      expect(result.isError).toBe(false);
    });

    it('should throw error for unknown tool', async () => {
      await expect(
        mcpClient.callTool({
          toolName: 'unknown_tool',
          arguments: {}
        })
      ).rejects.toThrow(MCPError);
    });

    it('should handle tool call errors', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Tool failed'));

      await expect(
        mcpClient.callTool({
          toolName: 'read_file',
          arguments: { path: './test.txt' }
        })
      ).rejects.toThrow(MCPError);
    });
  });

  describe('isReady', () => {
    it('should return false when not connected', () => {
      expect(mcpClient.isReady()).toBe(false);
    });

    it('should return true when connected', async () => {
      const mockStderr = new EventEmitter();
      const mockProcess = {
        on: jest.fn(),
        stderr: mockStderr,
        kill: jest.fn()
      } as unknown as ChildProcess;
      mockSpawn.mockReturnValue(mockProcess);

      await mcpClient.connect();
      
      expect(mcpClient.isReady()).toBe(true);
    });
  });
});