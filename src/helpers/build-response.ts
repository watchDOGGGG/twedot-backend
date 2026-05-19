/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express'
import { throwError } from './throw-error'

interface callBackParams {
  message: string
  statusCode?: number
}

interface successResponse<T> extends callBackParams {
  res: Response
  data: T
}

interface errorResponse extends callBackParams {
  errors?: any
}

class BuildResponse {
  public sendSuccessRes({ res, data, message, statusCode = 200 }: successResponse<any>) {
    return res.status(statusCode).json({
      message,
      data,
      success: true,
    })
  }

  public sendErrorRes({ errors = {}, message, statusCode = 400 }: errorResponse) {
    throwError(statusCode, {
      message,
      errors,
    })
  }

  public catchErrors({ errors, message, statusCode = 400 }: errorResponse) {
    return {
      errors,
      message,
      statusCode,
    }
  }
}

export const buildResponse = new BuildResponse()
