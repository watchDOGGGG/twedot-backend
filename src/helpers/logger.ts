import winston from 'winston'
import path from 'path'

const errorPath = path.join(__dirname, '../log/error.log')
const combinedPath = path.join(__dirname, '../log/combined.log')

export const initLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'souk', timestamp: new Date().toLocaleString() },
  transports: [
    new winston.transports.File({ filename: errorPath, level: 'error' }),
    new winston.transports.File({ filename: combinedPath, level: 'info' }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  initLogger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  )
}

class Logger {
  public info(message: string, service = 'souk', meta?: object) {
    initLogger.info(message, { ...meta, service })
  }

  public warn(message: string, service = 'souk', meta?: object) {
    initLogger.warn(message, { ...meta, service })
  }

  public error(message: string, service = 'souk', meta?: object) {
    initLogger.error(message, { ...meta, service })
  }
}

export const logger = new Logger()
