export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
  }
}

export class MCPError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MCP_ERROR', context);
  }
}

export class APIError extends BaseError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'API_ERROR', context);
  }
}

export class SchedulerError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SCHEDULER_ERROR', context);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}