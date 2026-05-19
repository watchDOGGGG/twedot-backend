/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'

const isProd = process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production'

export const errorHandler = (error: any, _: Request, res: Response, next: NextFunction) => {
  let finalMessage = error.message
  let duplicateError = undefined

  if (error.name === 'SequelizeUniqueConstraintError') {
    finalMessage = 'Duplicate entry'
    duplicateError = error.errors
  }

  if (error.name === 'SequelizeDatabaseError') {
    // Don't leak raw SQL errors to clients in production
    finalMessage = isProd ? 'A database error occurred' : error.message
  }

  if (error.code === 'ECONNREFUSED') {
    finalMessage = 'Service unavailable'
  }

  // Log full error server-side only — never expose internals to client
  logger.error(JSON.stringify({ message: error.message, stack: error.stack, code: error.code }), 'error-handler')

  const statusCode = error.status || error.statusCode || 500
  res.status(statusCode).json({
    message: isProd && statusCode === 500 ? 'An unexpected error occurred' : finalMessage,
    data: undefined,
    success: false,
    errors: duplicateError || {},
  })
  next()
}
