import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { throwError } from './throw-error'

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (errors.isEmpty()) {
    return next()
  }

  const extractedErrors: { msg: string; field: string }[] = []
  errors.array().map((err) => {
    extractedErrors.push({ msg: err.msg, field: err.param })
  })
  throwError(422, {
    message: 'Error processing request',
    errors: extractedErrors,
  })
}
