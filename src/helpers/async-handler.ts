/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction, Request } from 'express'

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>

export const asyncHandler = (execution: AsyncFunction) => (req: Request, res: Response, next: NextFunction) => {
  execution(req, res, next).catch(next)
}
