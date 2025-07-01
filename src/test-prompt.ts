#!/usr/bin/env node

import { configManager } from './config.js';
import { MCPClient } from './mcp-client.js';
import { ClaudeHandler } from './claude-handler.js';
import { createChildLogger } from './logger.js';
import { readFile } from 'fs/promises';
import path from 'path';

const testLogger = createChildLogger('test-prompt');

async function testPrompt(promptText?: string): Promise<void> {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    // Get prompt from argument or use a default
    const prompt = promptText ?? 'List all files in the current directory and describe what each file does.';
    
    testLogger.info('Testing prompt', { prompt });

    // Initialize MCP client
    const mcpClient = new MCPClient(config.mcp.filesystem);
    
    try {
      await mcpClient.connect();
      testLogger.info('MCP client connected');
      
      // List available tools
      const tools = mcpClient.getAvailableTools();
      testLogger.info('Available MCP tools', {
        count: tools.length,
        tools: tools.map(t => ({ name: t.name, description: t.description }))
      });
    } catch (error) {
      testLogger.error('Failed to connect to MCP server', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }

    // Initialize Claude handler
    const claudeHandler = new ClaudeHandler({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: config.anthropic.model,
      maxTokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature
    });

    // Execute the prompt
    testLogger.info('Executing prompt...');
    const startTime = Date.now();
    
    try {
      const result = await claudeHandler.executePrompt(prompt, mcpClient);
      const duration = Date.now() - startTime;
      
      testLogger.info('Prompt executed successfully', { duration });
      
      /* eslint-disable no-console */
      console.log(`\n${'='.repeat(80)}`);
      console.log('PROMPT:');
      console.log(prompt);
      console.log(`\n${'='.repeat(80)}`);
      console.log('RESPONSE:');
      console.log(result);
      console.log(`${'='.repeat(80)}\n`);
      /* eslint-enable no-console */
      
      // Save to file if requested
      if (process.argv.includes('--save')) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join('outputs', `test-prompt-${timestamp}.txt`);
        
        const { writeFile, mkdir } = await import('fs/promises');
        await mkdir('outputs', { recursive: true });
        
        const content = `Prompt: ${prompt}\n\nResponse:\n${result}\n\nTimestamp: ${new Date().toISOString()}\nDuration: ${duration}ms`;
        await writeFile(outputFile, content, 'utf-8');
        
        testLogger.info('Output saved', { file: outputFile });
      }
      
    } catch (error) {
      testLogger.error('Failed to execute prompt', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    } finally {
      await mcpClient.disconnect();
      testLogger.info('MCP client disconnected');
    }
    
  } catch (error) {
    testLogger.error('Test failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Parse command line arguments
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let promptText: string | undefined;
  
  // Check for prompt file
  const fileIndex = args.findIndex(arg => arg === '--file' || arg === '-f');
  const fileArg = fileIndex !== -1 ? args[fileIndex + 1] : undefined;
  if (fileArg !== undefined) {
    try {
      promptText = await readFile(fileArg, 'utf-8');
      testLogger.info('Loaded prompt from file', { file: fileArg });
    } catch (error) {
      testLogger.error('Failed to read prompt file', {
        file: fileArg,
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  } else {
    // Get prompt from remaining arguments
    const nonFlagArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
    if (nonFlagArgs.length > 0) {
      promptText = nonFlagArgs.join(' ');
    }
  }
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    /* eslint-disable no-console */
    console.log(`
Claude MCP Test Prompt Utility

Usage:
  npm run test-prompt -- [options] [prompt text]
  
Options:
  --file, -f <path>    Load prompt from a file
  --save              Save output to outputs/ directory
  --help, -h          Show this help message
  
Examples:
  npm run test-prompt -- "What files are in the current directory?"
  npm run test-prompt -- --file prompts/analyze.txt --save
  npm run test-prompt -- --save List all JavaScript files
`);
    /* eslint-enable no-console */
    process.exit(0);
  }
  
  await testPrompt(promptText);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    testLogger.error('Unhandled error', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}