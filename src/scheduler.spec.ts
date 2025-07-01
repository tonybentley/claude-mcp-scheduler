/* eslint-disable @typescript-eslint/unbound-method */
import { Scheduler } from './scheduler.js';
import { ClaudeHandler } from './claude-handler.js';
import { MCPClient } from './mcp-client.js';
import { Schedule } from './types/config.js';
import { SchedulerError } from './types/errors.js';
import cron from 'node-cron';
import * as fs from 'fs/promises';

jest.mock('node-cron');
jest.mock('./claude-handler.js');
jest.mock('./mcp-client.js');
jest.mock('fs/promises');

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let mockClaudeHandler: jest.Mocked<ClaudeHandler>;
  let mockMCPClient: jest.Mocked<MCPClient>;
  let mockScheduledTask: jest.Mocked<cron.ScheduledTask>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClaudeHandler = {
      executePrompt: jest.fn()
    } as unknown as jest.Mocked<ClaudeHandler>;

    mockMCPClient = {
      isReady: jest.fn().mockReturnValue(true),
      connect: jest.fn()
    } as unknown as jest.Mocked<MCPClient>;

    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn()
    } as unknown as jest.Mocked<cron.ScheduledTask>;

    (cron.schedule as jest.Mock).mockReturnValue(mockScheduledTask);
    (cron.validate as jest.Mock).mockReturnValue(true);

    scheduler = new Scheduler(mockClaudeHandler, mockMCPClient);
  });

  describe('start', () => {
    it('should schedule enabled tasks', () => {
      const schedules: Schedule[] = [
        {
          name: 'test-task',
          cron: '0 * * * *',
          enabled: true,
          prompt: 'Test prompt'
        },
        {
          name: 'disabled-task',
          cron: '0 * * * *',
          enabled: false,
          prompt: 'Disabled prompt'
        }
      ];

      scheduler.start(schedules);

      expect(cron.schedule).toHaveBeenCalledTimes(1);
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 * * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: true,
          timezone: 'UTC'
        })
      );
    });

    it('should validate cron expressions', () => {
      (cron.validate as jest.Mock).mockReturnValue(false);

      const schedules: Schedule[] = [{
        name: 'invalid-cron',
        cron: 'invalid',
        enabled: true,
        prompt: 'Test'
      }];

      expect(() => scheduler.start(schedules)).toThrow(SchedulerError);
    });

    it('should prevent duplicate schedules', () => {
      const schedule: Schedule = {
        name: 'duplicate',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test'
      };

      scheduler.start([schedule]);
      expect(() => scheduler.start([schedule])).toThrow(SchedulerError);
    });
  });

  describe('task execution', () => {
    it('should execute scheduled tasks', async () => {
      const schedule: Schedule = {
        name: 'test-task',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test prompt'
      };

      mockClaudeHandler.executePrompt.mockResolvedValue('Test result');

      scheduler.start([schedule]);

      // Get the callback passed to cron.schedule
      const mockCalls = (cron.schedule as jest.Mock).mock.calls as Array<[string, () => Promise<void>, unknown]>;
      const firstCall = mockCalls[0];
      if (firstCall) {
        const callback = firstCall[1];
        await callback();
      }

      expect(mockClaudeHandler.executePrompt).toHaveBeenCalledWith(
        'Test prompt',
        mockMCPClient
      );
    });

    it('should save output when path is specified', async () => {
      const schedule: Schedule = {
        name: 'test-task',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test prompt',
        outputPath: 'outputs/{name}-{date}.txt'
      };

      mockClaudeHandler.executePrompt.mockResolvedValue('Test result');
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      scheduler.start([schedule]);

      const mockCalls = (cron.schedule as jest.Mock).mock.calls as Array<[string, () => Promise<void>, unknown]>;
      const firstCall = mockCalls[0];
      if (firstCall) {
        const callback = firstCall[1];
        await callback();
      }

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-task'),
        'Test result',
        'utf-8'
      );
    });

    it('should reconnect MCP client if not ready', async () => {
      const schedule: Schedule = {
        name: 'test-task',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test prompt'
      };

      mockMCPClient.isReady.mockReturnValue(false);
      mockClaudeHandler.executePrompt.mockResolvedValue('Test result');

      scheduler.start([schedule]);

      const mockCalls = (cron.schedule as jest.Mock).mock.calls as Array<[string, () => Promise<void>, unknown]>;
      const firstCall = mockCalls[0];
      if (firstCall) {
        const callback = firstCall[1];
        await callback();
      }

      expect(mockMCPClient.connect).toHaveBeenCalled();
    });

    it('should handle execution errors gracefully', async () => {
      const schedule: Schedule = {
        name: 'test-task',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test prompt'
      };

      mockClaudeHandler.executePrompt.mockRejectedValue(new Error('API error'));

      scheduler.start([schedule]);

      const mockCalls = (cron.schedule as jest.Mock).mock.calls as Array<[string, () => Promise<void>, unknown]>;
      const firstCall = mockCalls[0];
      
      // Should not throw
      if (firstCall) {
        const callback = firstCall[1];
        await expect(callback()).resolves.not.toThrow();
      }
    });
  });

  describe('stop', () => {
    it('should stop specific task', () => {
      const schedule: Schedule = {
        name: 'test-task',
        cron: '0 * * * *',
        enabled: true,
        prompt: 'Test'
      };

      scheduler.start([schedule]);
      scheduler.stop('test-task');

      expect(mockScheduledTask.stop).toHaveBeenCalled();
      expect(scheduler.isTaskActive('test-task')).toBe(false);
    });

    it('should stop all tasks when no name provided', () => {
      const schedules: Schedule[] = [
        {
          name: 'task1',
          cron: '0 * * * *',
          enabled: true,
          prompt: 'Test 1'
        },
        {
          name: 'task2',
          cron: '0 * * * *',
          enabled: true,
          prompt: 'Test 2'
        }
      ];

      scheduler.start(schedules);
      scheduler.stop();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(2);
      expect(scheduler.getActiveTasks()).toHaveLength(0);
    });
  });

  describe('getActiveTasks', () => {
    it('should return list of active tasks', () => {
      const schedules: Schedule[] = [
        {
          name: 'task1',
          cron: '0 * * * *',
          enabled: true,
          prompt: 'Test 1'
        },
        {
          name: 'task2',
          cron: '30 * * * *',
          enabled: true,
          prompt: 'Test 2'
        }
      ];

      scheduler.start(schedules);
      const activeTasks = scheduler.getActiveTasks();

      expect(activeTasks).toHaveLength(2);
      const firstTask = activeTasks[0];
      expect(firstTask).toBeDefined();
      expect(firstTask?.name).toBe('task1');
      expect(firstTask?.cron).toBe('0 * * * *');
      expect(firstTask?.nextRun).toBeNull();
    });
  });
});