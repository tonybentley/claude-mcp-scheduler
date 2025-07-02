# Cron + MCP Demo: Scheduling Claude AI Tasks

A demonstration project showing how to integrate cron scheduling with Model Context Protocol (MCP) servers. This example uses the filesystem MCP server to show how Claude AI can perform scheduled tasks with access to local MCP servers running on your machine.

## What This Demo Shows

This project demonstrates how to:

- 🕒 **Schedule AI Tasks** - Use cron expressions to run Claude prompts at specific intervals
- 🤖 **Integrate with MCP** - Connect Claude to external tools via Model Context Protocol
- 📁 **Example: Filesystem Server** - Shows one MCP integration (filesystem access) as a practical example
- 🔌 **Extensible Architecture** - Easily add other MCP servers for databases, APIs, or custom tools
- 💾 **Manage Outputs** - Save and organize results from scheduled AI tasks
- 🔄 **Handle Errors Gracefully** - Robust error handling and automatic reconnection
- 🧪 **Test Before Scheduling** - Interactive prompt testing utility

## What is MCP (Model Context Protocol)?

Model Context Protocol is an open standard that enables AI assistants like Claude to securely interact with external tools and data sources. Instead of being limited to text generation, MCP allows Claude to:

- Access local files and directories
- Query databases
- Call APIs
- Execute custom tools
- And much more

This demo uses the filesystem MCP server as an example, but the architecture supports any MCP-compatible server. This makes it a perfect starting point for building scheduled AI workflows that need to interact with your specific tools and data sources.

## Why Use This Instead of Claude Desktop or Claude Code?

While Claude Desktop and Claude Code are excellent for interactive development, this scheduler demo offers unique advantages for different use cases:

### When to Use This Scheduler:
- **Automated Tasks** - Run AI tasks unattended on schedules (hourly reports, daily analysis, etc.)
- **Server Environments** - Deploy on headless servers, VMs, or containers without a GUI
- **Batch Processing** - Process multiple scheduled tasks in parallel
- **CI/CD Integration** - Embed AI tasks into existing automation workflows
- **Cost Optimization** - Only pay for API usage when scheduled tasks actually run
- **Custom MCP Servers** - Full control over which MCP servers are available and how they're configured

### When to Use Claude Desktop/Code:
- **Interactive Development** - Real-time coding assistance and exploration
- **One-off Tasks** - Quick questions or immediate help
- **Visual Work** - Tasks requiring UI interaction or visual feedback
- **Learning/Experimentation** - Exploring Claude's capabilities interactively

This demo bridges the gap between interactive AI assistants and production automation, showing how to leverage MCP servers in scheduled, unattended workflows.

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

Edit `config/config.json` to define your schedules. This example shows the filesystem MCP server, but you can easily add other MCP servers:

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
    // Add other MCP servers here:
    // "database": {
    //   "command": "npx",
    //   "args": ["-y", "@your-org/mcp-database-server"],
    //   "config": { ... }
    // },
    // "api": {
    //   "command": "npx", 
    //   "args": ["-y", "@your-org/mcp-api-server"],
    //   "config": { ... }
    // }
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