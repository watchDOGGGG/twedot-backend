// modules/users/user.controller.ts
import { asyncHandler, buildResponse } from '../../helpers'
import { Request } from 'express'
import {
  RegisterPayload,
  VerifyOtpPayload,
  CompleteProfilePayload,
  UpdateProfilePayload,
  ResendOtpPayload,
  SearchUsersPayload,
} from './user.interface'
import { userService } from './user.service'

const { sendSuccessRes } = buildResponse

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    phone_number?: string
  }
}

class UserController {
  private userS = userService

  public registerUser = asyncHandler(async (req, res) => {
    const payload: RegisterPayload = req.body
    const response = await this.userS.register(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'OTP sent successfully',
      res,
    })
  })

  public resendOtp = asyncHandler(async (req, res) => {
    const payload: ResendOtpPayload = req.body
    const response = await this.userS.resendOtp(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'OTP resent successfully',
      res,
    })
  })

  public verifyOtp = asyncHandler(async (req, res) => {
    const payload: VerifyOtpPayload = req.body
    const response = await this.userS.verifyOtp(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'OTP verified successfully',
      res,
    })
  })

  public refreshToken = asyncHandler(async (req, res) => {
    const { token } = req.body
    const deviceId = (req.headers['x-device-id'] as string) || (req.headers['device-id'] as string)

    const response = await this.userS.refreshToken(token, deviceId)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Token refreshed successfully',
      res,
    })
  })

  public completeProfile = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload: CompleteProfilePayload = {
      ...req.body,
      userId: req.user!.id,
    }
    const response = await this.userS.completeProfile(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: response.updated ? 'Profile updated successfully' : 'No changes made',
      res,
    })
  })

  public getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.getUserById(req.user!.id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'User fetched successfully',
      res,
    })
  })

  public getUserById = asyncHandler(async (req, res) => {
    const { user_id } = req.params
    const response = await this.userS.getUserById(user_id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'User fetched successfully',
      res,
    })
  })

  public getUserByPhoneNumber = asyncHandler(async (req, res) => {
    const { phone_number } = req.params
    const response = await this.userS.getUserByPhone(phone_number)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'User fetched successfully',
      res,
    })
  })

  public searchUsers = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload: SearchUsersPayload = {
      occupation: req.query.occupation as string,
      latitude: parseFloat(req.query.latitude as string),
      longitude: parseFloat(req.query.longitude as string),
    }

    const response = await this.userS.searchUsers(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Users found successfully',
      res,
    })
  })
  public verifyUserContacts = asyncHandler(async (req, res) => {
    const { contacts } = req.body
    const response = await this.userS.verifyUserContacts({ contacts })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Contacts verified successfully',
      res,
    })
  })

  public logout = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.access_token
    const response = await this.userS.logout(token)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Logged out successfully',
      res,
    })
  })

  public logoutAllDevices = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.logoutAllDevices(req.user!.id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Logged out from all devices successfully',
      res,
    })
  })

  public blockUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { user_id } = req.params
    const response = await this.userS.blockUser(req.user!.id, user_id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: response.alreadyBlocked ? 'User already blocked' : 'User blocked successfully',
      res,
    })
  })

  public unblockUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { user_id } = req.params
    const response = await this.userS.unblockUser(req.user!.id, user_id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'User unblocked successfully',
      res,
    })
  })

  public getBlockedUsers = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.getBlockedUsers(req.user!.id)

    sendSuccessRes({
      data: { blockedUsers: response },
      statusCode: 200,
      message: 'Blocked users fetched successfully',
      res,
    })
  })

  public updateProfile = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload: UpdateProfilePayload = {
      ...req.body,
      userId: req.user!.id,
    }
    const response = await this.userS.updateProfile(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: response.updated ? 'Profile updated successfully' : 'No changes made',
      res,
    })
  })

  public requestAccountInfo = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.requestAccountInfo(req.user!.id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Account info request received. Your data will be sent to your registered contact.',
      res,
    })
  })

  public deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.deleteAccount(req.user!.id)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Account deleted successfully',
      res,
    })
  })

  public savePublicKey = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { public_key } = req.body
    if (!public_key || typeof public_key !== 'string') {
      return res.status(400).json({ success: false, message: 'public_key is required' })
    }
    const response = await this.userS.savePublicKey(req.user!.id, public_key)
    sendSuccessRes({ data: response, statusCode: 200, message: 'Public key saved', res })
  })

  public getPublicKey = asyncHandler(async (req, res) => {
    const { user_id } = req.params
    const response = await this.userS.getPublicKey(user_id)
    sendSuccessRes({ data: response, statusCode: 200, message: 'Public key fetched', res })
  })

  public saveFcmToken = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { fcm_token } = req.body
    if (!fcm_token || typeof fcm_token !== 'string') {
      return res.status(400).json({ success: false, message: 'fcm_token is required' })
    }
    const deviceId = (req.headers['x-device-id'] as string) || (req.headers['device-id'] as string)
    const response = await this.userS.saveFcmToken(req.user!.id, fcm_token, deviceId)
    sendSuccessRes({ data: response, statusCode: 200, message: 'FCM token saved', res })
  })

  public deleteFcmToken = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.userS.deleteFcmToken(req.user!.id)
    sendSuccessRes({ data: response, statusCode: 200, message: 'FCM token removed', res })
  })

  public reportUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const reporterId: string = req.user!.id
    const { reportedUserId, reason } = req.body
    if (!reportedUserId || !reason) {
      return res.status(400).json({ success: false, message: 'reportedUserId and reason are required' })
    }
    const { default: sequelize } = await import('../../config/db-config/sequelize.instance')
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS user_reports (
        id SERIAL PRIMARY KEY,
        reporter_id VARCHAR(255) NOT NULL,
        reported_user_id VARCHAR(255) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    )
    await sequelize.query(
      `INSERT INTO user_reports (reporter_id, reported_user_id, reason) VALUES (:reporterId, :reportedUserId, :reason)`,
      { replacements: { reporterId, reportedUserId, reason } },
    )
    sendSuccessRes({ data: null, statusCode: 200, message: 'Report submitted', res })
  })
}

export const userController = new UserController()
