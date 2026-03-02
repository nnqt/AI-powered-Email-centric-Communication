import pino from "pino";

type LogContext = Record<string, unknown>;

class Logger {
  private logger: pino.Logger;
  private timers: Map<string, number>;

  constructor() {
    const isDev = process.env.NODE_ENV === "development";
    this.logger = pino({
      level: isDev ? "debug" : "info",
      ...(isDev && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "yyyy-mm-dd HH:MM:ss",
          },
        },
      }),
    });
    this.timers = new Map();
  }

  info(message: string, context: LogContext = {}): void {
    this.logger.info(context, message);
  }

  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(context, message);
  }

  error(message: string, context: LogContext = {}): void {
    this.logger.error(context, message);
  }

  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(context, message);
  }

  time(label: string): void {
    this.timers.set(label, performance.now());
  }

  timeEnd(label: string): void {
    const start = this.timers.get(label);
    if (start) {
      const duration = Math.round(performance.now() - start);
      this.info(`${label}: ${duration}ms`);
      this.timers.delete(label);
    }
  }
}

export const logger = new Logger();
