import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV !== 'production'
      ? winston.format.colorize({ all: true })
      : winston.format.uncolorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] [webhook] ${level}: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
