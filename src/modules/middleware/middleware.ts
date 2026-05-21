// modules/middleware/middleware.ts
import { Request, Response, NextFunction } from 'express'
import { asyncHandler, throwError } from '../../helpers'
import { userService } from '../users/user.service'

// Extend Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    phone_number?: string
  }
}

// modules/middleware/middleware.ts
export const authenticateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '') || req.cookies?.access_token
  const deviceId = (req.headers['x-device-id'] as string) || (req.headers['device-id'] as string)

  if (!token) {
    return throwError(401, 'Access token required')
  }

  if (!deviceId) {
    return throwError(401, 'Device ID required')
  }

  try {
    const authToken = await userService.verifyToken(token)

    if (!authToken) {
      return throwError(401, 'Invalid or expired token')
    }

    const now = new Date()
    if (new Date(authToken.expires) < now) {
      await userService.logout(token)
      return throwError(401, 'Session expired, please login again')
    }

    const isValidDevice = await userService.verifyDevice(authToken.user_id, deviceId)
    if (!isValidDevice) {
      await userService.logout(token)
      return throwError(401, {
        message: 'Device not recognized. Please login again.',
        logout: true,
      })
    }

    const user = await userService.getUserById(authToken.user_id)

    if (!user) {
      await userService.logout(token)
      return throwError(401, 'User not found')
    }

    // Allow profile completion even if profile incomplete
    const allowedPaths = ['/complete-profile', '/users/me', '/auth/logout']
    const allowedPrefixes = ['/upload']
    const pathAllowed = allowedPaths.includes(req.path) || allowedPrefixes.some(p => req.path.startsWith(p))
    if (!user.name && !pathAllowed) {
      return throwError(403, 'Please complete your profile first')
    }

    req.user = {
      id: authToken.user_id,
      phone_number: user.phone_number,
    }

    next()
  } catch (error: any) {
    if (error?.statusCode || error?.status) throw error
    return throwError(401, 'Authentication failed')
  }
})

// Optional: Check if profile is complete
export const requireCompleteProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return throwError(401, 'Not authenticated')
    }

    const user = await userService.getUserById(req.user.id)

    if (!user?.name) {
      return throwError(403, 'Please complete your profile')
    }

    next()
  },
)
