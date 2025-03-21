export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Completely disable logging
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Set appropriate log level based on environment
  setProductionMode(isProduction: boolean) {
    this.level = isProduction ? LogLevel.ERROR : LogLevel.DEBUG;
  }
}

// Create a singleton instance
export const logger = new Logger();

// Default to development mode (verbose logging)
logger.setLevel(LogLevel.ERROR);

// Function to set production mode from outside
export function setProductionLogging() {
  logger.setLevel(LogLevel.ERROR);
}

// Function to set development mode from outside
export function setDevelopmentLogging() {
  logger.setLevel(LogLevel.DEBUG);
}
