interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  private currentLevel: number;

  constructor() {
    const level = process.env.LOG_LEVEL || 'INFO';
    this.currentLevel = LOG_LEVELS[level.toUpperCase() as keyof LogLevel] ?? LOG_LEVELS.INFO;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
  }

  private log(level: keyof LogLevel, message: string, ...args: any[]): void {
    if (LOG_LEVELS[level] <= this.currentLevel) {
      const formattedMessage = this.formatMessage(level, message, ...args);
      
      switch (level) {
        case 'ERROR':
          console.error(formattedMessage);
          break;
        case 'WARN':
          console.warn(formattedMessage);
          break;
        case 'INFO':
          console.info(formattedMessage);
          break;
        case 'DEBUG':
          console.debug(formattedMessage);
          break;
      }
    }
  }

  public error(message: string, ...args: any[]): void {
    this.log('ERROR', message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.log('WARN', message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    this.log('INFO', message, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    this.log('DEBUG', message, ...args);
  }

  public setLevel(level: keyof LogLevel): void {
    this.currentLevel = LOG_LEVELS[level];
    this.info(`Log level set to ${level}`);
  }
}

export const logger = new Logger();