/* eslint-disable @typescript-eslint/no-explicit-any */
import createError from 'http-errors'

export const throwError = (status: number, error: any) => {
  throw createError(status, error)
}
