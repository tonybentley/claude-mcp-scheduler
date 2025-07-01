import { ClaudeHandler } from '../src/claude-handler.js';
import { MCPClient } from '../src/mcp-client.js';
import { MCPFilesystemConfig } from '../src/types/config.js';
import dotenv from 'dotenv';

dotenv.config();

describe('ClaudeHandler Integration', () => {
  let claudeHandler: ClaudeHandler;
  let mcpClient: MCPClient;

  const mcpConfig: MCPFilesystemConfig = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    allowedDirectories: ['./data', './reports', './outputs']
  };

  beforeAll(async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for integration tests');
    }

    claudeHandler = new ClaudeHandler({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
      temperature: 0.3
    });

    mcpClient = new MCPClient(mcpConfig);
    await mcpClient.connect();
  }, 30000);

  afterAll(async () => {
    await mcpClient.disconnect();
  });

  it('should execute a simple prompt without tools', async () => {
    const prompt = 'What is 2 + 2? Reply with just the number.';
    const result = await claudeHandler.executePrompt(prompt, mcpClient);
    
    expect(result).toBeDefined();
    expect(result).toContain('4');
  }, 30000);

  it('should execute prompts with filesystem tools', async () => {
    const prompt = 'List the files in the current directory. Just show the file names.';
    const result = await claudeHandler.executePrompt(prompt, mcpClient);
    
    expect(result).toBeDefined();
    expect(result.toLowerCase()).toContain('package.json');
  }, 30000);

  it('should handle file reading operations', async () => {
    const prompt = 'Read the package.json file and tell me the name of this project.';
    const result = await claudeHandler.executePrompt(prompt, mcpClient);
    
    expect(result).toBeDefined();
    expect(result.toLowerCase()).toContain('claude-mcp-scheduler');
  }, 30000);

  it('should handle errors gracefully', async () => {
    const prompt = 'Try to read a file that does not exist: /nonexistent/file.txt';
    const result = await claudeHandler.executePrompt(prompt, mcpClient);
    
    expect(result).toBeDefined();
    expect(result.toLowerCase()).toMatch(/error|not found|does not exist|cannot/);
  }, 30000);
});