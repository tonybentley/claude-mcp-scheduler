import { MCPClient } from '../src/mcp-client.js';
import { MCPFilesystemConfig } from '../src/types/config.js';

describe('MCPClient Integration', () => {
  let mcpClient: MCPClient;

  const testConfig: MCPFilesystemConfig = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    allowedDirectories: ['./data', './reports']
  };

  beforeEach(() => {
    mcpClient = new MCPClient(testConfig);
  });

  afterEach(async () => {
    await mcpClient.disconnect();
  });

  it('should handle connection lifecycle', async () => {
    // Test connection
    await expect(mcpClient.connect()).resolves.not.toThrow();
    expect(mcpClient.isReady()).toBe(true);

    // Test disconnection
    await expect(mcpClient.disconnect()).resolves.not.toThrow();
    expect(mcpClient.isReady()).toBe(false);
  }, 30000);

  it('should discover filesystem tools', async () => {
    await mcpClient.connect();
    
    const tools = mcpClient.getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);
    
    // Check for common filesystem tools
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('list_directory');
  }, 30000);

  it('should handle tool calls', async () => {
    await mcpClient.connect();
    
    // Test reading a file that exists
    const result = await mcpClient.callTool({
      toolName: 'read_file',
      arguments: { path: './package.json' }
    });

    expect(result).toBeDefined();
    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle tool call errors gracefully', async () => {
    await mcpClient.connect();
    
    // Test reading a file that doesn't exist
    const result = await mcpClient.callTool({
      toolName: 'read_file',
      arguments: { path: './non-existent-file.txt' }
    });

    expect(result).toBeDefined();
    expect(result.isError).toBeTruthy();
  }, 30000);
});