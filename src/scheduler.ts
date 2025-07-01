import cron from 'node-cron';
import { Schedule } from './types/config.js';
import { ClaudeHandler } from './claude-handler.js';
import { MCPClient } from './mcp-client.js';
import { SchedulerError } from './types/errors.js';
import { createChildLogger } from './logger.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const logger = createChildLogger('scheduler');

interface ScheduledTask {
  schedule: Schedule;
  task: cron.ScheduledTask;
}

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private claudeHandler: ClaudeHandler;
  private mcpClient: MCPClient;

  constructor(claudeHandler: ClaudeHandler, mcpClient: MCPClient) {
    this.claudeHandler = claudeHandler;
    this.mcpClient = mcpClient;
  }

  start(schedules: Schedule[]): void {
    logger.info('Starting scheduler', { schedulesCount: schedules.length });

    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.scheduleTask(schedule);
      } else {
        logger.debug('Skipping disabled schedule', { name: schedule.name });
      }
    }

    logger.info('Scheduler started', { 
      activeTasksCount: this.tasks.size,
      totalSchedules: schedules.length 
    });
  }

  private scheduleTask(schedule: Schedule): void {
    if (this.tasks.has(schedule.name)) {
      throw new SchedulerError(`Schedule '${schedule.name}' is already scheduled`);
    }

    if (!cron.validate(schedule.cron)) {
      throw new SchedulerError(`Invalid cron expression for schedule '${schedule.name}': ${schedule.cron}`);
    }

    const task = cron.schedule(
      schedule.cron,
      () => {
        void this.executeSchedule(schedule);
      },
      {
        scheduled: true,
        timezone: process.env.TZ ?? 'UTC'
      }
    );

    this.tasks.set(schedule.name, { schedule, task });
    
    logger.info('Task scheduled', {
      name: schedule.name,
      cron: schedule.cron,
      nextRun: this.getNextRunTime(schedule.cron)
    });
  }

  private async executeSchedule(schedule: Schedule): Promise<void> {
    const startTime = Date.now();
    logger.info('Executing scheduled task', { name: schedule.name });

    try {
      // Ensure MCP client is connected
      if (!this.mcpClient.isReady()) {
        logger.warn('MCP client not ready, attempting to reconnect');
        await this.mcpClient.connect();
      }

      // Execute the prompt
      const result = await this.claudeHandler.executePrompt(
        schedule.prompt,
        this.mcpClient
      );

      // Save output if path is specified
      if (schedule.outputPath !== undefined) {
        await this.saveOutput(schedule.name, schedule.outputPath, result);
      }

      const duration = Date.now() - startTime;
      logger.info('Scheduled task completed', {
        name: schedule.name,
        duration,
        outputSaved: Boolean(schedule.outputPath)
      });
    } catch (error) {
      logger.error('Failed to execute scheduled task', {
        name: schedule.name,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      // Don't throw - let the scheduler continue running
    }
  }

  private async saveOutput(
    scheduleName: string,
    outputPath: string,
    content: string
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = outputPath
        .replace('{name}', scheduleName)
        .replace('{timestamp}', timestamp)
        .replace('{date}', new Date().toISOString().split('T')[0] ?? '');

      const fullPath = path.resolve(filename);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      await mkdir(dir, { recursive: true });

      // Write the file
      await writeFile(fullPath, content, 'utf-8');

      logger.debug('Output saved', {
        schedule: scheduleName,
        path: fullPath,
        size: content.length
      });
    } catch (error) {
      logger.error('Failed to save output', {
        schedule: scheduleName,
        path: outputPath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new SchedulerError(`Failed to save output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  stop(scheduleName?: string): void {
    if (scheduleName !== undefined) {
      const task = this.tasks.get(scheduleName);
      if (task) {
        task.task.stop();
        this.tasks.delete(scheduleName);
        logger.info('Task stopped', { name: scheduleName });
      } else {
        logger.warn('Task not found', { name: scheduleName });
      }
    } else {
      // Stop all tasks
      for (const [name, task] of this.tasks) {
        task.task.stop();
        logger.debug('Stopping task', { name });
      }
      this.tasks.clear();
      logger.info('All tasks stopped');
    }
  }

  getActiveTasks(): Array<{ name: string; cron: string; nextRun: Date | null }> {
    return Array.from(this.tasks.values()).map(({ schedule }) => ({
      name: schedule.name,
      cron: schedule.cron,
      nextRun: this.getNextRunTime(schedule.cron)
    }));
  }

  private getNextRunTime(_cronExpression: string): Date | null {
    // For now, return null since node-cron doesn't expose next run time
    // This could be enhanced with a cron parser library
    return null;
  }

  isTaskActive(scheduleName: string): boolean {
    return this.tasks.has(scheduleName);
  }
}