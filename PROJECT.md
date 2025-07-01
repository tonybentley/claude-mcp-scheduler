# Claude MCP Scheduler - Project Outline

## 1. Project Overview

### 1.1 Description
A Node.js-based scheduling system that executes Claude AI prompts at specified intervals with access to local filesystem through Model Context Protocol (MCP) servers.

### 1.2 Core Capabilities
- Automated prompt execution via cron scheduling
- Local filesystem access through MCP integration
- Configurable prompt templates and schedules
- Output management with timestamped results
- Comprehensive logging and monitoring

### 1.3 Use Cases
- Automated report generation
- System health monitoring
- Data analysis and processing
- File system auditing
- Scheduled content generation

## 2. Technical Requirements

### 2.1 System Requirements

#### Runtime Environment
- **Node.js**: v18.0.0 or higher (ES modules support required)
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Storage**: 100MB for application + space for logs/outputs

#### Network Requirements
- Internet connection for Anthropic API access
- HTTPS outbound connections allowed
- No incoming connections required

### 2.2 Dependencies

#### Core Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.24.3",      // Anthropic Claude API client
  "@modelcontextprotocol/sdk": "^0.5.0", // MCP protocol implementation
  "node-cron": "^3.0.3",                // Cron job scheduling
  "dotenv": "^16.4.5",                  // Environment variable management
  "winston": "^3.13.0"                  // Logging framework
}
```

#### Development Dependencies
```json
{
  "@types/node": "^20.14.9"             // TypeScript definitions (for IDE support)
}
```

### 2.3 External Services

#### Anthropic API
- **Requirement**: Valid Anthropic API key (default type)
- **Endpoint**: https://api.anthropic.com
- **Model**: claude-3-5-sonnet-20241022 (configurable)
- **Rate Limits**: Based on API tier
- **Token Limits**: 
  - Input: Based on model context window
  - Output: Configurable (default 4096)

#### MCP Servers
- **Default**: `@modelcontextprotocol/server-filesystem`
- **Protocol**: JSON-RPC over stdio
- **Installation**: Via npx (automatic)

## 3. Architecture

### 3.1 Component Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│                 │     │              │     │             │
│   Scheduler     │────▶│   Claude     │────▶│  Anthropic  │
│   (node-cron)   │     │   Handler    │     │     API     │
│                 │     │              │     │             │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                               │ Tool Calls
                               ▼
                        ┌──────────────┐
                        │              │
                        │  MCP Client  │
                        │              │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │              │
                        │  MCP Server  │
                        │ (Filesystem) │
                        │              │
                        └──────────────┘
```

### 3.2 Data Flow

1. **Schedule Trigger** → Cron job activates
2. **Prompt Execution** → Claude Handler sends prompt to API
3. **Tool Discovery** → MCP Client provides available tools
4. **API Request** → Claude processes prompt with tool access
5. **Tool Invocation** → Claude requests filesystem operations
6. **MCP Processing** → Server executes filesystem commands
7. **Response Generation** → Claude creates final output
8. **Output Storage** → Results saved to configured location

### 3.3 Directory Structure

```
claude-mcp-scheduler/
├── src/                    # Source code
│   ├── index.js           # Application entry point
│   ├── scheduler.js       # Cron job management
│   ├── mcp-client.js      # MCP server communication
│   ├── claude-handler.js  # Anthropic API integration
│   ├── logger.js          # Winston logger setup
│   └── test-prompt.js     # Testing utility
├── config/                # Configuration files
│   └── config.json        # Main configuration
├── logs/                  # Application logs
├── outputs/               # Generated outputs
├── data/                  # User data directory
├── reports/               # User reports directory
└── tests/                 # Test files (future)
```

## 4. Configuration Schema

### 4.1 Main Configuration (config.json)

```typescript
interface Config {
  schedules: Schedule[];
  mcp: MCPConfig;
  anthropic: AnthropicConfig;
  logging: LoggingConfig;
}

interface Schedule {
  name: string;           // Unique identifier
  cron: string;          // Cron expression
  enabled: boolean;      // Active flag
  prompt: string;        // Claude prompt
  outputPath?: string;   // Optional output file path
}

interface MCPConfig {
  filesystem: {
    command: string;           // Command to start server
    args: string[];           // Command arguments
    allowedDirectories: string[]; // Accessible paths
  };
}

interface AnthropicConfig {
  model: string;         // Model identifier
  maxTokens: number;     // Max output tokens
  temperature: number;   // Response creativity (0-1)
}

interface LoggingConfig {
  level: string;         // Log level (debug|info|warn|error)
  file: string;          // Log file path
}
```

### 4.2 Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional
NODE_ENV=production|development
LOG_LEVEL=debug|info|warn|error
```

## 5. Security Considerations

### 5.1 API Key Management
- Store API keys in environment variables only
- Never commit `.env` files to version control
- Use `.env.template` for documentation
- Rotate keys regularly

### 5.2 Filesystem Access
- MCP server restricted to allowed directories
- No write access outside designated areas
- Path traversal prevention
- Input sanitization for file operations

### 5.3 Output Security
- Sanitize generated filenames
- Validate output paths
- Prevent directory traversal in outputs
- Set appropriate file permissions

## 6. Performance Specifications

### 6.1 Resource Usage
- **Memory**: ~100-200MB base + variable based on file operations
- **CPU**: Minimal when idle, spikes during prompt execution
- **Disk I/O**: Dependent on file operations and logging
- **Network**: API calls only during prompt execution

### 6.2 Scalability Limits
- **Concurrent Jobs**: Limited by Node.js event loop
- **File Size**: MCP server memory constraints
- **API Rate Limits**: Based on Anthropic tier
- **Token Limits**: Model context window (200k for Sonnet)

### 6.3 Optimization Strategies
- Implement request queuing for multiple schedules
- Cache MCP tool descriptions
- Batch file operations when possible
- Implement exponential backoff for API errors

## 7. Error Handling

### 7.1 Error Categories
1. **API Errors**
   - Rate limiting
   - Authentication failures
   - Network timeouts
   - Invalid requests

2. **MCP Errors**
   - Server startup failures
   - Communication errors
   - Tool execution failures
   - Permission denied

3. **System Errors**
   - File system errors
   - Memory constraints
   - Process crashes

### 7.2 Recovery Strategies
- Automatic retry with exponential backoff
- Graceful degradation for non-critical errors
- Error logging and alerting
- State persistence for recovery

## 8. Monitoring & Logging

### 8.1 Log Levels
- **DEBUG**: Detailed execution flow
- **INFO**: Normal operations
- **WARN**: Recoverable issues
- **ERROR**: Failures requiring attention

### 8.2 Metrics to Track
- Prompt execution success/failure rates
- API token usage
- Execution duration
- Error frequency by type
- Output file generation

### 8.3 Health Checks
- MCP server connectivity
- API key validity
- Filesystem permissions
- Cron job status

## 9. Development Roadmap

### Phase 1: Core Implementation ✅
- Basic scheduler functionality
- MCP filesystem integration
- Claude API integration
- Configuration system
- Logging infrastructure

### Phase 2: Enhanced Features
- [ ] Multiple MCP server support
- [ ] Web dashboard for monitoring
- [ ] Prompt templates with variables
- [ ] Conditional scheduling
- [ ] Output post-processing

### Phase 3: Advanced Capabilities
- [ ] Distributed execution
- [ ] Database integration
- [ ] Webhook notifications
- [ ] Custom MCP server SDK
- [ ] Plugin architecture

### Phase 4: Enterprise Features
- [ ] Multi-tenant support
- [ ] Role-based access control
- [ ] Audit logging
- [ ] High availability setup
- [ ] Kubernetes deployment

## 10. Testing Strategy

### 10.1 Unit Tests
- Individual component testing
- Mock API responses
- Mock MCP server behavior
- Configuration validation

### 10.2 Integration Tests
- End-to-end prompt execution
- MCP server communication
- Error handling scenarios
- Output generation

### 10.3 Performance Tests
- Concurrent schedule execution
- Large file handling
- API rate limit behavior
- Memory usage under load

## 11. Deployment

### 11.1 Local Development
```bash
npm install
npm run dev  # Watch mode
```

### 11.2 Production Deployment
```bash
npm install --production
npm start
```

### 11.3 Container Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
CMD ["npm", "start"]
```

### 11.4 Process Management
- Use PM2 for production
- Systemd service for Linux
- Windows Service for Windows
- Launchd for macOS

## 12. Maintenance

### 12.1 Regular Tasks
- Log rotation
- Output directory cleanup
- API key rotation
- Dependency updates

### 12.2 Monitoring
- Check scheduler health
- Review error logs
- Monitor API usage
- Track output generation

### 12.3 Backup Strategy
- Configuration backups
- Output archive policy
- Log retention policy
- State recovery procedures
