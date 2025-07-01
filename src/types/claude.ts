export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ClaudeResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeHandlerOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}