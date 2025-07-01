import Anthropic from '@anthropic-ai/sdk';
import { ClaudeHandlerOptions, ClaudeMessage, ClaudeToolUse, ClaudeToolResult, ClaudeResponse } from './types/claude.js';
import { MCPClient } from './mcp-client.js';
import { MCPTool } from './types/mcp.js';
import { APIError } from './types/errors.js';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('claude-handler');

export class ClaudeHandler {
  private anthropic: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: ClaudeHandlerOptions) {
    this.anthropic = new Anthropic({
      apiKey: options.apiKey
    });
    this.model = options.model;
    this.maxTokens = options.maxTokens;
    this.temperature = options.temperature;
  }

  async executePrompt(
    prompt: string,
    mcpClient: MCPClient
  ): Promise<string> {
    if (!mcpClient.isReady()) {
      throw new APIError('MCP client is not connected');
    }

    const tools = mcpClient.getAvailableTools();
    const messages: ClaudeMessage[] = [{ role: 'user', content: prompt }];
    
    logger.info('Executing prompt', {
      model: this.model,
      promptLength: prompt.length,
      toolsCount: tools.length
    });

    try {
      const response = await this.sendRequest(messages, tools);
      return await this.processResponse(response, mcpClient, messages);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new APIError(
          `Anthropic API error: ${error.message}`,
          error.status,
          { error: error.message }
        );
      }
      throw error;
    }
  }

  private async sendRequest(
    messages: ClaudeMessage[],
    tools: MCPTool[]
  ): Promise<ClaudeResponse> {
    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        ...tool.inputSchema,
        type: 'object' as const
      }
    }));

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      tools: claudeTools.length > 0 ? claudeTools : undefined
    });

    logger.debug('Claude API response', {
      stopReason: response.stop_reason,
      usage: response.usage
    });

    return response as unknown as ClaudeResponse;
  }

  private async processResponse(
    response: ClaudeResponse,
    mcpClient: MCPClient,
    messages: ClaudeMessage[]
  ): Promise<string> {
    let textContent = '';
    const toolUses: ClaudeToolUse[] = [];

    // Extract text and tool uses from response
    for (const content of response.content) {
      if (content.type === 'text' && content.text !== undefined) {
        textContent += content.text;
      } else if (content.type === 'tool_use' && 
                 content.id !== undefined && 
                 content.name !== undefined && 
                 content.input !== undefined) {
        toolUses.push({
          id: content.id,
          name: content.name,
          input: content.input
        });
      }
    }

    // If no tool uses, return the text content
    if (toolUses.length === 0) {
      return textContent;
    }

    // Execute tool calls
    const toolResults: ClaudeToolResult[] = [];
    for (const toolUse of toolUses) {
      logger.debug('Executing tool', {
        toolName: toolUse.name,
        toolId: toolUse.id
      });

      try {
        const result = await mcpClient.callTool({
          toolName: toolUse.name,
          arguments: toolUse.input
        });

        const resultText = result.content
          .filter(item => item.text !== undefined)
          .map(item => item.text)
          .join('\n');

        toolResults.push({
          tool_use_id: toolUse.id,
          content: resultText,
          is_error: result.isError
        });
      } catch (error) {
        logger.error('Tool execution failed', {
          toolName: toolUse.name,
          error: error instanceof Error ? error.message : String(error)
        });

        toolResults.push({
          tool_use_id: toolUse.id,
          content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true
        });
      }
    }

    // Add assistant message and tool results to conversation
    messages.push({
      role: 'assistant',
      content: textContent
    });

    // Send follow-up request with tool results
    const followUpResponse = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user' as const,
          content: toolResults.map(result => ({
            type: 'tool_result' as const,
            tool_use_id: result.tool_use_id,
            content: result.content,
            is_error: result.is_error
          }))
        }
      ]
    });

    // Extract final text response
    let finalText = '';
    for (const content of followUpResponse.content) {
      if (content.type === 'text') {
        finalText += content.text;
      }
    }

    logger.info('Prompt execution completed', {
      totalTokens: response.usage.input_tokens + response.usage.output_tokens + 
                   followUpResponse.usage.input_tokens + followUpResponse.usage.output_tokens,
      toolCallsCount: toolUses.length
    });

    return finalText;
  }
}