interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export function createLogger(component: string): Logger {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const shouldLog = (level: string): boolean => {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(logLevel);
  };

  return {
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog('info')) {
        console.log(`[${new Date().toISOString()}] [${component}] INFO: ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(`[${new Date().toISOString()}] [${component}] WARN: ${message}`, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(`[${new Date().toISOString()}] [${component}] ERROR: ${message}`, ...args);
      }
    },
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(`[${new Date().toISOString()}] [${component}] DEBUG: ${message}`, ...args);
      }
    },
  };
}