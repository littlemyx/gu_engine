import * as fs from 'node:fs';
import * as path from 'node:path';

const LOG_DIR = path.resolve('logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, 'image_gen.log');

function timestamp(): string {
  return new Date().toISOString();
}

function writeLine(level: string, msg: string) {
  const line = `[${timestamp()}] [${level}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

export const logger = {
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
  /** Path to the log file, for reference */
  filePath: LOG_FILE,
};
