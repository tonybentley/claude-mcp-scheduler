# Claude AI Development Guidelines

## Project Context
This is a Claude MCP Scheduler project that executes Claude AI prompts at specified intervals with access to local filesystem through Model Context Protocol (MCP) servers.

## Development Rules

### 1. Code Standards
- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (type: "module" in package.json)
- **Target**: ES2022 or later
- **Build Output**: Compile to /dist directory

### 2. Testing Requirements
- **Unit Tests**: Create .spec.ts files alongside implementation code
- **Integration Tests**: Create .e2e.spec.ts files in /test/ directory
- **No Mocking**: Test with live integrations, never mock implementations
- **Test Before Completion**: Validate all code changes work before considering complete

### 3. Code Quality
- **ESLint**: Run eslint on every file before considering it complete
- **Fix All Errors**: Must fix all ESLint errors (warnings can be ignored)
- **Build Validation**: Run TypeScript compiler after changes to ensure no compile errors
- **Incremental Development**: Add features incrementally and validate each before moving to next

### 4. File Organization
```
src/
   *.ts           # Implementation files
   *.spec.ts      # Unit tests (alongside implementation)
   types/         # TypeScript type definitions
   utils/         # Shared utilities

test/
   *.e2e.spec.ts  # Integration tests

dist/              # Compiled output (git ignored)
```

### 5. Parallel Agent Guidelines
When multiple agents work on this project:

#### Context Sharing
- Read this CLAUDE.md file at the start of each session
- Check existing code structure before creating new files
- Follow established patterns in existing code
- Maintain consistent naming conventions

#### Code Consistency
- Use existing utilities and types rather than creating duplicates
- Follow the established error handling patterns
- Maintain consistent logging approach using Winston
- Use the same configuration schema defined in types

#### Testing Approach
- Each agent must run tests for their changes
- Integration tests must validate actual functionality
- Never skip tests even for "simple" changes
- Run the full test suite before completing work

#### Communication Through Code
- Write clear, self-documenting code
- Add JSDoc comments for public APIs
- Update type definitions when adding new interfaces
- Keep configuration examples up to date

### 6. Security Guidelines
- **API Keys**: Always use environment variables, never hardcode
- **File Access**: Validate all file paths and prevent directory traversal
- **User Input**: Sanitize all user-provided configuration values
- **Secrets**: Never log sensitive information

### 7. Error Handling
- Use consistent error types defined in src/types/errors.ts
- Always include context in error messages
- Implement retry logic for transient failures
- Log errors appropriately based on severity

### 8. Build and Validation Commands
```bash
# Lint files
npm run lint

# Fix lint errors
npm run lint:fix

# Run TypeScript compiler
npm run build

# Run unit tests
npm test

# Run integration tests
npm run test:e2e

# Run all validations
npm run validate
```

### 9. Git Workflow
- Create meaningful commit messages
- Never commit node_modules or dist directories
- Keep .env.local for local development (git ignored)
- Use .env.example for documenting required variables

### 10. MCP Integration Rules
- Always validate MCP server is running before making calls
- Handle MCP communication errors gracefully
- Respect filesystem boundaries configured in MCP
- Log all MCP operations for debugging

## Project-Specific Context

### Current Implementation Status
- Core TypeScript structure: ✅ Complete
- Logger module: ✅ Complete (winston with file/console output)
- Configuration system: ✅ Complete (with validation and type safety)
- MCP client: ✅ Complete (filesystem server integration)
- Claude handler: ✅ Complete (Anthropic API with tool support)
- Scheduler: ✅ Complete (node-cron based scheduling)
- Main application: ✅ Complete (with graceful shutdown)
- Test utility: ✅ Complete (interactive prompt testing)
- Tests: ✅ Complete (unit and integration tests)

### Key Dependencies
- @anthropic-ai/sdk - Claude API client
- @modelcontextprotocol/sdk - MCP protocol
- node-cron - Scheduling
- winston - Logging
- dotenv - Environment management

### Environment Variables
Required:
- ANTHROPIC_API_KEY - Stored in .env file (not tracked in git)

Optional:
- NODE_ENV - development/production
- LOG_LEVEL - debug/info/warn/error
- TZ - Timezone for cron schedules (default: UTC)

### MCP Integration Details
The MCP filesystem server is spawned as a child process with:
- Command: `npx -y @modelcontextprotocol/server-filesystem`
- Arguments: Allowed directories passed as command args
- Default: Current working directory
- Available tools: 12 filesystem operations (read, write, list, search, etc.)

### Known Issues and Solutions
1. **MCP Connection**: Fixed by passing directories as command arguments
2. **Jest/ESM**: Some tests skip MCP SDK due to ESM compatibility
3. **Next Run Time**: node-cron doesn't expose next execution time

### Configuration Schema
Located in `src/types/config.ts`:
- Schedules with cron expressions
- MCP filesystem settings
- Anthropic model configuration
- Logging preferences

### Testing Approach
- Unit tests: Mock external dependencies
- Integration tests: Real MCP server connections
- No mocking of core implementation
- ESLint validation before completion

## Project Architecture

### Key Files and Their Purposes
1. **src/index.ts** - Main entry point, orchestrates all components
2. **src/scheduler.ts** - Manages cron jobs and task execution
3. **src/claude-handler.ts** - Handles Anthropic API communication
4. **src/mcp-client.ts** - Manages MCP server lifecycle and tool calls
5. **src/config.ts** - Configuration loading and validation
6. **src/logger.ts** - Winston-based logging setup
7. **src/test-prompt.ts** - Utility for testing prompts interactively

### Data Flow
1. Config loaded → Schedules parsed
2. MCP server spawned → Tools discovered
3. Cron triggers → Prompt sent to Claude
4. Claude uses MCP tools → Response generated
5. Output saved to file → Next execution scheduled

### Error Handling Strategy
- All errors logged with context
- MCP reconnection on failure
- Scheduler continues despite individual task failures
- Graceful shutdown on SIGINT/SIGTERM

## Notes for Agents
1. Always validate your understanding of existing code before making changes
2. Run tests frequently during development
3. Keep this file updated with any new patterns or decisions
4. When in doubt, favor consistency with existing code over introducing new patterns
5. The project is fully functional - MCP connects and discovers 12 filesystem tools
6. API calls require valid Anthropic credits to execute