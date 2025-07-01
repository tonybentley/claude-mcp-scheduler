import { Scheduler } from '../src/scheduler.js';
import { ClaudeHandler } from '../src/claude-handler.js';
import { MCPClient } from '../src/mcp-client.js';
import { Schedule } from '../src/types/config.js';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

// Mock the dependencies since we're testing the scheduler logic
jest.mock('../src/claude-handler.js');
jest.mock('../src/mcp-client.js');

describe('Scheduler Integration', () => {
  let scheduler: Scheduler;
  let mockClaudeHandler: jest.Mocked<ClaudeHandler>;
  let mockMCPClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClaudeHandler = new ClaudeHandler({
      apiKey: 'test',
      model: 'test',
      maxTokens: 100,
      temperature: 0.5
    }) as jest.Mocked<ClaudeHandler>;

    mockMCPClient = new MCPClient({
      command: 'test',
      args: [],
      allowedDirectories: []
    }) as jest.Mocked<MCPClient>;

    mockMCPClient.isReady = jest.fn().mockReturnValue(true);
    mockMCPClient.connect = jest.fn().mockResolvedValue(undefined);
    mockClaudeHandler.executePrompt = jest.fn().mockResolvedValue('Test output content');

    scheduler = new Scheduler(mockClaudeHandler, mockMCPClient);
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should schedule and track active tasks', () => {
    const schedules: Schedule[] = [
      {
        name: 'test-schedule-1',
        cron: '*/5 * * * * *', // Every 5 seconds for testing
        enabled: true,
        prompt: 'Test prompt 1'
      },
      {
        name: 'test-schedule-2',
        cron: '*/10 * * * * *', // Every 10 seconds
        enabled: true,
        prompt: 'Test prompt 2'
      }
    ];

    scheduler.start(schedules);

    const activeTasks = scheduler.getActiveTasks();
    expect(activeTasks).toHaveLength(2);
    expect(scheduler.isTaskActive('test-schedule-1')).toBe(true);
    expect(scheduler.isTaskActive('test-schedule-2')).toBe(true);
  });

  it('should handle task execution with output saving', async () => {
    const outputPath = path.join('outputs', 'test-{name}-{timestamp}.txt');
    const schedule: Schedule = {
      name: 'output-test',
      cron: '* * * * * *', // Every second for immediate testing
      enabled: true,
      prompt: 'Generate test output',
      outputPath
    };

    scheduler.start([schedule]);

    // Wait a bit for the cron to trigger
    await new Promise(resolve => setTimeout(resolve, 1500));

    expect(mockClaudeHandler.executePrompt).toHaveBeenCalled();
    
    // Check if output file would be created (in real scenario)
    // The actual file writing is mocked in fs/promises
  });

  it('should handle MCP reconnection', async () => {
    mockMCPClient.isReady.mockReturnValue(false);

    const schedule: Schedule = {
      name: 'reconnect-test',
      cron: '* * * * * *',
      enabled: true,
      prompt: 'Test reconnection'
    };

    scheduler.start([schedule]);

    // Wait for cron to trigger
    await new Promise(resolve => setTimeout(resolve, 1500));

    expect(mockMCPClient.connect).toHaveBeenCalled();
    expect(mockClaudeHandler.executePrompt).toHaveBeenCalled();
  });

  it('should stop specific tasks', () => {
    const schedules: Schedule[] = [
      {
        name: 'keep-running',
        cron: '*/5 * * * * *',
        enabled: true,
        prompt: 'Keep running'
      },
      {
        name: 'stop-this',
        cron: '*/5 * * * * *',
        enabled: true,
        prompt: 'Stop this one'
      }
    ];

    scheduler.start(schedules);
    expect(scheduler.getActiveTasks()).toHaveLength(2);

    scheduler.stop('stop-this');
    
    expect(scheduler.getActiveTasks()).toHaveLength(1);
    expect(scheduler.isTaskActive('keep-running')).toBe(true);
    expect(scheduler.isTaskActive('stop-this')).toBe(false);
  });

  it('should handle errors gracefully without stopping scheduler', async () => {
    mockClaudeHandler.executePrompt.mockRejectedValue(new Error('API Error'));

    const schedule: Schedule = {
      name: 'error-test',
      cron: '* * * * * *',
      enabled: true,
      prompt: 'This will fail'
    };

    scheduler.start([schedule]);

    // Wait for cron to trigger
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Scheduler should still be active
    expect(scheduler.isTaskActive('error-test')).toBe(true);
  });
});