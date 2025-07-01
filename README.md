# Claude MCP Scheduler

A Node.js-based scheduling system that executes Claude AI prompts at specified intervals with access to local filesystem through Model Context Protocol (MCP) servers.

## Features

- 🕒 **Cron-based Scheduling** - Schedule prompts to run at specific times using cron expressions
- 🤖 **Claude AI Integration** - Execute prompts using Anthropic's Claude API
- 📁 **Filesystem Access** - Read and analyze files through MCP filesystem server
- 💾 **Output Management** - Save results with customizable paths and timestamps
- 📊 **Comprehensive Logging** - Winston-based logging with multiple levels
- 🔄 **Error Recovery** - Automatic MCP reconnection and graceful error handling
- 🧪 **Test Utility** - Interactive prompt testing before scheduling

## Prerequisites

- Node.js v18.0.0 or higher
- Anthropic API key
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd claude-mcp-scheduler
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Anthropic API key:
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

4. Copy the example configuration:
```bash
cp config/config.example.json config/config.json
```

## Configuration

Edit `config/config.json` to define your schedules:

```json
{
  "schedules": [
    {
      "name": "file-check",
      "cron": "* * * * *",
      "enabled": true,
      "prompt": "List all files in the current directory and report how many files exist.",
      "outputPath": "outputs/file-check-{timestamp}.txt"
    }
  ],
  "mcp": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "allowedDirectories": ["./data", "./reports"]
    }
  },
  "anthropic": {
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096,
    "temperature": 0.7
  }
}
```

### Schedule Configuration

- `name`: Unique identifier for the schedule
- `cron`: Cron expression (e.g., "0 * * * *" for every hour)
- `enabled`: Whether the schedule is active
- `prompt`: The prompt to send to Claude
- `outputPath`: (Optional) Path to save output, supports placeholders:
  - `{name}` - Schedule name
  - `{timestamp}` - Full timestamp
  - `{date}` - Date in YYYY-MM-DD format

### Cron Expression Examples

- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 9 * * *` - Daily at 9 AM
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on the 1st

## Usage

### Running the Scheduler

```bash
npm start
```

The scheduler will:
1. Load your configuration
2. Connect to the MCP filesystem server
3. Start scheduled tasks
4. Run until stopped with Ctrl+C

### Testing Prompts

Use the test utility to try prompts before scheduling:

```bash
# Test with a simple prompt
npm run test-prompt -- "List all files in the current directory"

# Test with a prompt file
npm run test-prompt -- --file prompts/analyze.txt

# Save test output
npm run test-prompt -- --save "Analyze the package.json file"
```

### Output Files

Generated outputs are saved to:
- Scheduled outputs: As specified in `outputPath`
- Test outputs: `outputs/test-prompt-{timestamp}.txt`
- Logs: `logs/combined.log` and `logs/error.log`

## Directory Structure

```
claude-mcp-scheduler/
├── config/              # Configuration files
│   └── config.json      # Your schedule configuration
├── src/                 # Source code
├── dist/                # Compiled JavaScript
├── logs/                # Application logs
├── outputs/             # Generated outputs
├── data/                # Your data directory
└── reports/             # Your reports directory
```

## Development

### Building

```bash
npm run build
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Linting

```bash
# Check for issues
npm run lint

# Fix issues
npm run lint:fix
```

## Troubleshooting

### MCP Server Connection Issues

If the MCP server fails to connect:
1. Ensure `@modelcontextprotocol/server-filesystem` is installed globally or available via npx
2. Check that allowed directories exist and have proper permissions
3. Review logs for specific error messages

### API Rate Limits

If you encounter rate limits:
1. Reduce the frequency of scheduled tasks
2. Implement longer delays between prompts
3. Check your Anthropic API tier limits

### Memory Usage

For large file operations:
1. Monitor memory usage in logs
2. Consider breaking large prompts into smaller tasks
3. Adjust Node.js memory limits if needed

## Security Considerations

- API keys are stored in environment variables, never in code
- Filesystem access is restricted to configured directories
- All file paths are validated to prevent directory traversal
- Sensitive data is never logged

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Support

For issues and questions:
- Check the logs in `logs/` directory
- Review the troubleshooting section
- Create an issue on GitHub