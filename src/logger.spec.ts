import { logger, createChildLogger } from './logger.js';
import winston from 'winston';

describe('Logger', () => {
  it('should create a logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(winston.Logger);
  });

  it('should have the correct log level from environment', () => {
    const expectedLevel = process.env.LOG_LEVEL ?? 'info';
    expect(logger.level).toBe(expectedLevel);
  });

  it('should have console and file transports', () => {
    const transports = logger.transports;
    expect(transports).toHaveLength(3);
    
    const hasConsoleTransport = transports.some(t => t instanceof winston.transports.Console);
    const hasFileTransport = transports.some(t => t instanceof winston.transports.File);
    
    expect(hasConsoleTransport).toBe(true);
    expect(hasFileTransport).toBe(true);
  });

  it('should create child logger with service context', () => {
    const childLogger = createChildLogger('test-service');
    
    expect(childLogger).toBeDefined();
    expect(childLogger).toBeInstanceOf(winston.Logger);
  });

  it('should log messages without errors', () => {
    expect(() => {
      logger.info('Test info message');
      logger.warn('Test warning message');
      logger.error('Test error message');
      logger.debug('Test debug message');
    }).not.toThrow();
  });

  it('should handle metadata in logs', () => {
    expect(() => {
      logger.info('Test message with metadata', { 
        userId: '123', 
        action: 'test' 
      });
    }).not.toThrow();
  });

  it('should handle error objects', () => {
    const testError = new Error('Test error');
    expect(() => {
      logger.error('Error occurred', { error: testError });
    }).not.toThrow();
  });
});