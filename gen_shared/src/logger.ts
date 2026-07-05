import * as fs from 'node:fs';
import * as path from 'node:path';

export type Logger = {
  log: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  filePath: string;
};

/**
 * Логгер сервиса: дублирует в консоль и файл logs/<serviceName>.log
 * (относительно cwd сервиса).
 */
export function createLogger(serviceName: string): Logger {
  const logDir = path.resolve('logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${serviceName}.log`);

  const timestamp = () => new Date().toISOString();
  const writeLine = (level: string, msg: string) => {
    fs.appendFileSync(logFile, `[${timestamp()}] [${level}] ${msg}\n`);
  };

  return {
    log(msg: string) {
      console.log(msg);
      writeLine('INFO', msg);
    },
    warn(msg: string) {
      console.warn(msg);
      writeLine('WARN', msg);
    },
    error(msg: string) {
      console.error(msg);
      writeLine('ERROR', msg);
    },
    filePath: logFile,
  };
}
