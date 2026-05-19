import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { throwError } from './throw-error'

export const validateBody = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.') || 'body',
      msg: e.message,
    }))
    return throwError(422, { message: 'Validation failed', errors })
  }
  req.body = result.data
  next()
}
