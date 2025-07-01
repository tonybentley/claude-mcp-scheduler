#!/usr/bin/env node

import { configManager } from './config.js';
import { MCPClient } from './mcp-client.js';
import { ClaudeHandler } from './claude-handler.js';
import { Scheduler } from './scheduler.js';
import { logger } from './logger.js';
import { ConfigurationError } from './types/errors.js';

async function main(): Promise<void> {
  logger.info('Starting Claude MCP Scheduler');

  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    if (config.schedules.length === 0) {
      logger.warn('No schedules configured. Please add schedules to config/config.json');
      return;
    }

    // Initialize MCP client
    const mcpClient = new MCPClient(config.mcp.filesystem);
    
    try {
      await mcpClient.connect();
      logger.info('MCP client connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MCP server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ConfigurationError('MCP server connection failed. Ensure the server is installed and accessible.');
    }

    // Initialize Claude handler
    const claudeHandler = new ClaudeHandler({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: config.anthropic.model,
      maxTokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature
    });

    // Initialize scheduler
    const scheduler = new Scheduler(claudeHandler, mcpClient);

    // Start scheduling tasks
    scheduler.start(config.schedules);

    // Set up graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      scheduler.stop();
      await mcpClient.disconnect();
      
      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

    // Keep the process running
    logger.info('Scheduler is running. Press Ctrl+C to stop.');
    
    // Log active schedules
    const activeTasks = scheduler.getActiveTasks();
    activeTasks.forEach(task => {
      logger.info('Scheduled task', {
        name: task.name,
        cron: task.cron,
        nextRun: task.nextRun ?? 'Unable to calculate'
      });
    });

  } catch (error) {
    logger.error('Fatal error during startup', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error in main', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}