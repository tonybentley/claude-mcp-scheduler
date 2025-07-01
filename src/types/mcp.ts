export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  toolCallId: string;
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}