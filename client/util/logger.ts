export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Completely disable logging
}

class Logger {
  private defaultLevel: LogLevel = LogLevel.INFO;
  private loggerLevels: Map<string, LogLevel> = new Map();
  private name?: string;

  constructor(name?: string) {
    this.name = name;
  }

  // Set default level for all loggers without a specific level
  setDefaultLevel(level: LogLevel) {
    this.defaultLevel = level;
  }

  // Set level for a specific named logger
  setLoggerLevel(loggerName: string, level: LogLevel) {
    this.loggerLevels.set(loggerName, level);
  }

  // Get level for current logger (use named level or default)
  getLevel(): LogLevel {
    if (this.name && this.loggerLevels.has(this.name)) {
      return this.loggerLevels.get(this.name)!;
    }
    return this.defaultLevel;
  }

  // Create a new named logger instance
  getLogger(name: string): Logger {
    return new Logger(name);
  }

  debug(message: string, ...args: any[]) {
    if (this.getLevel() <= LogLevel.DEBUG) {
      const prefix = this.name ? `[DEBUG:${this.name}]` : `[DEBUG]`;
      console.log(`${prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.getLevel() <= LogLevel.INFO) {
      const prefix = this.name ? `[INFO:${this.name}]` : `[INFO]`;
      console.log(`${prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.getLevel() <= LogLevel.WARN) {
      const prefix = this.name ? `[WARN:${this.name}]` : `[WARN]`;
      console.warn(`${prefix} ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.getLevel() <= LogLevel.ERROR) {
      const prefix = this.name ? `[ERROR:${this.name}]` : `[ERROR]`;
      console.error(`${prefix} ${message}`, ...args);
    }
  }

  // Set appropriate log level based on environment
  setProductionMode(isProduction: boolean) {
    this.defaultLevel = isProduction ? LogLevel.ERROR : LogLevel.DEBUG;
  }
}

// Create a singleton root logger instance
export const logger = new Logger();

// Default to ERROR level
logger.setDefaultLevel(LogLevel.ERROR);

// Function to set production mode from outside
export function setProductionLogging() {
  logger.setDefaultLevel(LogLevel.ERROR);
}

// Function to set development mode from outside
export function setDevelopmentLogging() {
  logger.setDefaultLevel(LogLevel.DEBUG);
}

// Helper to get a named logger
export function getLogger(name: string): Logger {
  return logger.getLogger(name);
}
