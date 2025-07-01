/* eslint-disable @typescript-eslint/unbound-method */
import { ClaudeHandler } from './claude-handler.js';
import { MCPClient } from './mcp-client.js';
import { APIError } from './types/errors.js';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');
jest.mock('./mcp-client.js');

describe('ClaudeHandler', () => {
  let claudeHandler: ClaudeHandler;
  let mockMCPClient: jest.Mocked<MCPClient>;
  let mockAnthropic: jest.Mocked<Anthropic>;
  let mockMessagesCreate: jest.Mock;

  const testOptions = {
    apiKey: 'test-api-key',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMessagesCreate = jest.fn();
    mockAnthropic = {
      messages: {
        create: mockMessagesCreate
      }
    } as unknown as jest.Mocked<Anthropic>;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    mockMCPClient = {
      isReady: jest.fn().mockReturnValue(true),
      getAvailableTools: jest.fn().mockReturnValue([]),
      callTool: jest.fn()
    } as unknown as jest.Mocked<MCPClient>;

    claudeHandler = new ClaudeHandler(testOptions);
  });

  describe('executePrompt', () => {
    it('should execute a simple prompt without tools', async () => {
      const prompt = 'What is 2 + 2?';
      const responseText = '2 + 2 equals 4.';

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 }
      });

      const result = await claudeHandler.executePrompt(prompt, mockMCPClient);

      expect(result).toBe(responseText);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: testOptions.model,
        max_tokens: testOptions.maxTokens,
        temperature: testOptions.temperature,
        messages: [{ role: 'user', content: prompt }],
        tools: undefined
      });
    });

    it('should throw error if MCP client is not ready', async () => {
      mockMCPClient.isReady.mockReturnValue(false);

      await expect(
        claudeHandler.executePrompt('test prompt', mockMCPClient)
      ).rejects.toThrow(APIError);
    });

    it('should handle prompts with tool usage', async () => {
      const prompt = 'Read the file test.txt';
      const tools = [{
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object' as const,
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }];

      mockMCPClient.getAvailableTools.mockReturnValue(tools);

      // First response with tool use
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'I\'ll read the file for you.' },
          { 
            type: 'tool_use', 
            id: 'tool-123',
            name: 'read_file',
            input: { path: 'test.txt' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 30 }
      });

      // Tool execution result
      mockMCPClient.callTool.mockResolvedValue({
        toolCallId: 'tool-123',
        content: [{ type: 'text', text: 'File contents: Hello World!' }],
        isError: false
      });

      // Second response after tool execution
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'The file contains: Hello World!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 40, output_tokens: 50 }
      });

      const result = await claudeHandler.executePrompt(prompt, mockMCPClient);

      expect(result).toBe('The file contains: Hello World!');
      expect(mockMCPClient.callTool).toHaveBeenCalledWith({
        toolName: 'read_file',
        arguments: { path: 'test.txt' }
      });
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle tool execution errors', async () => {
      const prompt = 'Read a file';
      const tools = [{
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object' as const,
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }];

      mockMCPClient.getAvailableTools.mockReturnValue(tools);

      // First response with tool use
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { 
            type: 'tool_use', 
            id: 'tool-456',
            name: 'read_file',
            input: { path: 'nonexistent.txt' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 30 }
      });

      // Tool execution error
      mockMCPClient.callTool.mockRejectedValue(new Error('File not found'));

      // Second response after tool error
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Sorry, the file could not be read.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 40, output_tokens: 50 }
      });

      const result = await claudeHandler.executePrompt(prompt, mockMCPClient);

      expect(result).toBe('Sorry, the file could not be read.');
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors', async () => {
      const apiError = new Anthropic.APIError(
        400,
        { type: 'invalid_request_error', message: 'Invalid request' },
        'Invalid request',
        {}
      );

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(
        claudeHandler.executePrompt('test prompt', mockMCPClient)
      ).rejects.toThrow(APIError);
    });
  });
});