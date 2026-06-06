// modules/users/user.service.ts
import { Op, literal, WhereOptions } from 'sequelize'
import { redisClient } from '../../config/redis'
import { throwError } from '../../helpers'
import { logger } from '../../helpers/logger'
import UserRepository from './repositories/user.repository'
import DeviceRepository from './repositories/user.deviceinfo.repository'
import AuthRepository from './repositories/user.authentication.repository'
import BlockedUsersRepository from './repositories/user.blockedusers.repository'
import {
  RegisterPayload,
  VerifyOtpPayload,
  CompleteProfilePayload,
  UpdateProfilePayload,
  ResendOtpPayload,
  SearchUsersPayload,
  USER_MODEL,
} from './user.interface'
import crypto from 'crypto'
import { sendSms } from '../../config/sms.config'

class UserService {
  private readonly OTP_TTL = 300 // 5 minutes
  private readonly OTP_COOLDOWN = 60 // 1 minute
  private readonly TOKEN_EXPIRY_DAYS = 365 // 1 year
  private readonly MAX_OTP_ATTEMPTS = 5

  private generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString()
  }

  private generateAuthToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  private getOtpKey(phone: string): string {
    return `otp:${phone}`
  }

  private getOtpCooldownKey(phone: string): string {
    return `otp:cooldown:${phone}`
  }

  private getRegistrationAttemptsKey(phone: string): string {
    return `otp:attempts:${phone}`
  }

  private getOtpVerifyAttemptsKey(phone: string): string {
    return `otp:verify:attempts:${phone}`
  }

  public async register(payload: RegisterPayload) {
    const { phone_number, country_code } = payload

    const cooldownKey = this.getOtpCooldownKey(phone_number)
    const isCooldown = await redisClient.get(cooldownKey)

    if (isCooldown) {
      return throwError(429, { message: 'Please wait before requesting new OTP' })
    }

    const existingUser = await UserRepository.findOne({
      where: { phone_number },
    })

    const otp = this.generateOtp()
    const otpKey = this.getOtpKey(phone_number)
    console.log(`[DEV] OTP for ${phone_number}: ${otp}`)

    await redisClient.setEx(otpKey, this.OTP_TTL, otp)
    await redisClient.setEx(cooldownKey, this.OTP_COOLDOWN, '1')

    if (existingUser?.is_verified) {
      try { await sendSms(phone_number, `Your Twedot verification code is: ${otp}. Valid for 5 minutes.`) } catch (e: any) { logger.error('SMS send failed:', e) }

      return {
        message: 'OTP sent successfully',
        phone_number,
        existingUser: true,
        otp,
      }
    }

    // create minimal user if not exists
    if (!existingUser) {
      await UserRepository.create({
        phone_number,
        country_code,
        name: null,
        occupation: null,
        profile_photo_url: null,
        is_verified: false,
        country: null,
        city: null,
        latitude: null,
        longitude: null,
      } as any)
    }

    const attemptsKey = this.getRegistrationAttemptsKey(phone_number)
    const attempts = await redisClient.incr(attemptsKey)

    if (attempts === 1) {
      await redisClient.expire(attemptsKey, 3600)
    }

    if (attempts > this.MAX_OTP_ATTEMPTS) {
      return throwError(429, { message: 'Too many attempts. Try again later.' })
    }

    try { await sendSms(phone_number, `Your Twedot verification code is: ${otp}. Valid for 5 minutes.`) } catch (e: any) { logger.error('SMS send failed:', e) }
    return {
      message: 'OTP sent successfully',
      phone_number,
      existingUser: false,
      otp,
    }
  }

  public async resendOtp(payload: ResendOtpPayload) {
    const { phone_number } = payload

    const cooldownKey = this.getOtpCooldownKey(phone_number)
    const isCooldown = await redisClient.get(cooldownKey)
    if (isCooldown) {
      return throwError(429, { message: 'Please wait before requesting new OTP' })
    }

    const newOtp = this.generateOtp()
    console.log(`[DEV] OTP for ${phone_number}: ${newOtp}`)
    await redisClient.setEx(this.getOtpKey(phone_number), this.OTP_TTL, newOtp)
    await redisClient.setEx(cooldownKey, this.OTP_COOLDOWN, '1')

    try { await sendSms(phone_number, `Your Twedot verification code is: ${newOtp}. Valid for 5 minutes.`) } catch (e: any) { logger.error('SMS send failed:', e) }

    return {
      message: 'OTP resent successfully',
      phone_number,
      otp: newOtp,
    }
  }

  public async verifyOtp(payload: VerifyOtpPayload & { device_id: string }) {
    const { phone_number, otp, device_id } = payload

    const verifyAttemptsKey = this.getOtpVerifyAttemptsKey(phone_number)
    const verifyAttempts = await redisClient.incr(verifyAttemptsKey)

    if (verifyAttempts === 1) {
      await redisClient.expire(verifyAttemptsKey, 3600)
    }

    if (verifyAttempts > 3) {
      await redisClient.del(this.getOtpKey(phone_number))
      return throwError(429, { message: 'Too many failed attempts. Request new OTP.' })
    }

    const storedOtp = await redisClient.get(this.getOtpKey(phone_number))

    if (!storedOtp) {
      return throwError(400, { message: 'OTP expired. Please request new one.' })
    }

    if (storedOtp !== otp) {
      return throwError(400, { message: 'Invalid OTP.' })
    }

    const user = await UserRepository.findOne({ where: { phone_number } })

    if (!user) {
      return throwError(404, { message: 'User not found' })
    }

    // verify user
    user.is_verified = true
    await user.save()

    // clear OTP
    await redisClient.del(this.getOtpKey(phone_number))
    await redisClient.del(verifyAttemptsKey)
    await redisClient.del(this.getRegistrationAttemptsKey(phone_number))

    // DEVICE SECURITY LOGIC
    const existingDevice = await DeviceRepository.findOne({
      where: { device_id },
    })

    if (existingDevice) {
      if (existingDevice.user_id !== user.id) {
        // logout previous user sessions
        await AuthRepository.destroy({
          where: { user_id: existingDevice.user_id },
        })

        // reassign device to this user
        await existingDevice.update({
          user_id: user.id,
        })
      }
    } else {
      await this.createOrUpdateDevice(user.id, device_id)
    }

    // create auth token
    const token = this.generateAuthToken()

    const expires = new Date()
    expires.setDate(expires.getDate() + this.TOKEN_EXPIRY_DAYS)

    await AuthRepository.create({
      user_id: user.id,
      token: this.hashToken(token),
      expires,
    } as any)

    return {
      user,
      token,
      expires,
      profileComplete: user.name !== null,
    }
  }

  private async createOrUpdateDevice(userId: string, deviceId: string) {
    const deviceOwner = await DeviceRepository.findOne({
      where: { device_id: deviceId },
    })

    if (deviceOwner && deviceOwner.user_id !== userId) {
      await AuthRepository.destroy({
        where: { user_id: deviceOwner.user_id },
      })

      deviceOwner.user_id = userId
      await deviceOwner.save()

      return deviceOwner
    }

    const existing = await DeviceRepository.findOne({
      where: { user_id: userId },
    })

    if (existing) {
      if (existing.device_id !== deviceId) {
        existing.device_id = deviceId
        await existing.save()
      }
      return existing
    }

    return DeviceRepository.create({
      user_id: userId,
      device_id: deviceId,
    } as any)
  }

  public async completeProfile(payload: CompleteProfilePayload) {
    const { userId, ...updates } = payload

    const user = await UserRepository.findByPk(userId)
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }

    if (!user.is_verified) {
      return throwError(403, { message: 'Phone not verified' })
    }

    const allowedFields = ['name', 'occupation', 'city', 'country', 'latitude', 'longitude', 'profile_photo_url']
    let hasChanges = false

    for (const [key, value] of Object.entries(updates)) {
      // Skip if undefined, null, or empty string
      if (value === undefined || value === null || value === '') continue

      // Skip if same value
      if (value === (user as any)[key])
        continue

        // Update
      ;(user as any)[key] = value
      hasChanges = true
    }

    if (hasChanges) {
      await user.save()
    }

    return {
      user,
      updated: hasChanges,
    }
  }

  public async getUserById(userId: string) {
    const user = await UserRepository.findByPk(userId, {
      include: ['inventories'],
    })
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }
    const isOnlineFlag = await redisClient.exists(`online:${userId}`)
    const lastSeen = await redisClient.get(`lastseen:${userId}`)
    return {
      ...user.toJSON(),
      is_online: isOnlineFlag === 1,
      last_seen: lastSeen || null,
    }
  }

  public async getUserByPhone(phone_number: string) {
    const user = await UserRepository.findOne({
      where: { phone_number },
      include: ['inventories'],
    })
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }
    return user
  }

  public async searchUsers(payload: SearchUsersPayload) {
    const { occupation, latitude, longitude } = payload
    const RADIUS_KM = 10

    const occupations = occupation.split(',').map((o) => o.trim()).filter(Boolean)
    const replacements: Record<string, any> = { lat: latitude, lng: longitude }

    let occupationFilter: string
    if (occupations.length === 1) {
      occupationFilter = 'AND occupation ILIKE :occ0'
      replacements.occ0 = `%${occupations[0]}%`
    } else {
      occupationFilter = `AND (${occupations.map((_, i) => `occupation ILIKE :occ${i}`).join(' OR ')})`
      occupations.forEach((occ, i) => { replacements[`occ${i}`] = `%${occ}%` })
    }

    const query = `
    SELECT
      id,
      phone_number,
      name,
      occupation,
      profile_photo_url,
      country,
      city,
      latitude,
      longitude,
      is_verified,
      created_at,
      updated_at,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
      ) / 1000 AS distance_km
    FROM users
    WHERE
      is_verified = true
      ${occupationFilter}
      AND name IS NOT NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY distance_km ASC
    LIMIT 50
  `

    const users = (await UserRepository.sequelize!.query(query, {
      replacements,
      type: 'SELECT',
      raw: true,
    })) as any[]

    const nearby: any[] = []
    const wider: any[] = []

    for (const user of users) {
      const dist = parseFloat(user.distance_km)
      if (dist <= RADIUS_KM && nearby.length < 20) {
        nearby.push({ ...user, distance_km: dist })
      } else if (wider.length < 30) {
        wider.push({ ...user, distance_km: dist })
      }
    }

    return { nearby, wider }
  }

  public async verifyToken(token: string) {
    const authToken = await AuthRepository.findOne({
      where: { token: this.hashToken(token) },
      include: [{ model: UserRepository, as: 'user' }],
    })

    if (!authToken) {
      return null
    }

    if (new Date() > new Date(authToken.expires)) {
      await AuthRepository.destroy({ where: { id: authToken.id } })
      return null
    }

    return authToken
  }

  public async refreshToken(oldToken: string, deviceId: string) {
    const authToken = await AuthRepository.findOne({
      where: { token: this.hashToken(oldToken) },
    })

    if (!authToken) {
      return throwError(401, { message: 'Invalid token' })
    }

    const isValidDevice = await this.verifyDevice(authToken.user_id, deviceId)
    if (!isValidDevice) {
      return throwError(401, { message: 'Device not recognized' })
    }

    const newToken = this.generateAuthToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + this.TOKEN_EXPIRY_DAYS)

    await AuthRepository.destroy({ where: { id: authToken.id } })

    await AuthRepository.create({
      user_id: authToken.user_id,
      token: this.hashToken(newToken),
      expires,
    } as any)

    return {
      token: newToken,
      expires,
    }
  }

  public async logout(token: string) {
    await AuthRepository.destroy({ where: { token: this.hashToken(token) } })
    return { message: 'Logged out successfully' }
  }

  public async logoutAllDevices(userId: string) {
    await AuthRepository.destroy({ where: { user_id: userId } })
    return { message: 'Logged out from all devices' }
  }

  public async deleteAccount(userId: string) {
    const user = await UserRepository.findByPk(userId)
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }

    await AuthRepository.destroy({ where: { user_id: userId } })
    await DeviceRepository.destroy({ where: { user_id: userId } })
    await user.destroy()

    return { message: 'Account deleted successfully' }
  }

  public async verifyUserContacts(payload: { contacts: { phone_number: string; name: string }[]; requestingUserId?: string }) {
    const { contacts, requestingUserId } = payload

    if (!contacts || contacts.length === 0) {
      return { inSystem: [], notInSystem: [] }
    }

    if (contacts.length > 100) {
      return throwError(400, { message: 'Maximum of 100 contacts allowed per request' })
    }

    const phoneNumbers = contacts.map((c) => c.phone_number)

    const users = await UserRepository.findAll({
      where: {
        phone_number: { [Op.in]: phoneNumbers },
        is_verified: true,
        name: { [Op.ne]: null },
      },
      attributes: ['id', 'phone_number', 'name', 'occupation', 'profile_photo_url', 'city'],
    })

    const userMap = new Map(users.map((u) => [u.phone_number, u]))

    const inSystem: any[] = []
    const notInSystem: any[] = []

    for (const contact of contacts) {
      const matchedUser = userMap.get(contact.phone_number)

      if (matchedUser) {
        inSystem.push({
          user_id: matchedUser.id,
          phone_number: contact.phone_number,
          contact_name: contact.name,
          app_name: matchedUser.name,
          occupation: matchedUser.occupation,
          profile_photo_url: matchedUser.profile_photo_url,
          city: matchedUser.city,
        })
      } else {
        notInSystem.push({
          phone_number: contact.phone_number,
          contact_name: contact.name,
        })
      }
    }

    // Fire-and-forget: notify existing users that the new user has joined
    if (requestingUserId && inSystem.length > 0) {
      this.notifyJoiningUser(requestingUserId, inSystem).catch(() => {})
    }

    return {
      inSystem,
      notInSystem,
      totalInSystem: inSystem.length,
      totalNotInSystem: notInSystem.length,
    }
  }

  private async notifyJoiningUser(userId: string, inSystemContacts: any[]) {
    try {
      const alreadyNotified = await redisClient.get(`join_notified:${userId}`)
      if (alreadyNotified) return

      const user = await UserRepository.findByPk(userId, { attributes: ['name', 'profile_photo_url'] })
      if (!user || !(user as any).name) return

      await redisClient.setEx(`join_notified:${userId}`, 86400 * 30, '1')

      const { notificationService } = await import('../notifications/notification.service')
      for (const contact of inSystemContacts) {
        notificationService
          .sendJoinNotification(contact.user_id, (user as any).name, userId, (user as any).profile_photo_url ?? null)
          .catch(() => {})
      }
    } catch (err) {
      logger.error('[JoinNotify] error:', err as any)
    }
  }

  public async updateProfile(payload: UpdateProfilePayload) {
    const { userId, ...updates } = payload

    const user = await UserRepository.findByPk(userId)
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }

    const allowedFields = [
      'name',
      'occupation',
      'city',
      'country',
      'latitude',
      'longitude',
      'profile_photo_url',
      'website',
    ]
    let hasChanges = false

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') continue
      if (!allowedFields.includes(key)) continue
      if (value === (user as any)[key]) continue
      ;(user as any)[key] = value
      hasChanges = true
    }

    if (hasChanges) {
      await user.save()
    }

    return { user, updated: hasChanges }
  }

  public async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      return throwError(400, { message: 'You cannot block yourself' })
    }

    const blockedUser = await UserRepository.findByPk(blockedId)
    if (!blockedUser) {
      return throwError(404, { message: 'User not found' })
    }

    const existing = await BlockedUsersRepository.findOne({
      where: { blocker_id: blockerId, blocked_id: blockedId },
    })

    if (existing) {
      return { alreadyBlocked: true }
    }

    await BlockedUsersRepository.create({
      blocker_id: blockerId,
      blocked_id: blockedId,
    } as any)

    return { blocked: true }
  }

  public async unblockUser(blockerId: string, blockedId: string) {
    const record = await BlockedUsersRepository.findOne({
      where: { blocker_id: blockerId, blocked_id: blockedId },
    })

    if (!record) {
      return throwError(404, { message: 'Block record not found' })
    }

    await record.destroy()
    return { unblocked: true }
  }

  public async getBlockedUsers(userId: string) {
    const records = await BlockedUsersRepository.findAll({
      where: { blocker_id: userId },
      include: [
        {
          model: UserRepository,
          as: 'blockedUser',
          attributes: ['id', 'name', 'phone_number', 'profile_photo_url', 'occupation'],
        },
      ],
      order: [['created_at', 'DESC']],
    })

    return records.map((r: any) => ({
      id: r.blockedUser.id,
      name: r.blockedUser.name,
      phone_number: r.blockedUser.phone_number,
      profile_photo_url: r.blockedUser.profile_photo_url,
      occupation: r.blockedUser.occupation,
      blocked_at: r.created_at,
    }))
  }

  public async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const record = await BlockedUsersRepository.findOne({
      where: { blocker_id: blockerId, blocked_id: blockedId },
    })
    return !!record
  }

  public async requestAccountInfo(userId: string) {
    const user = await UserRepository.findByPk(userId)
    if (!user) {
      return throwError(404, { message: 'User not found' })
    }
    return { requested: true }
  }

  public async verifyDevice(userId: string, deviceId: string): Promise<boolean> {
    const device = await DeviceRepository.findOne({ where: { user_id: userId } })
    return device?.device_id === deviceId
  }

  public async savePublicKey(userId: string, publicKey: string) {
    const user = await UserRepository.findByPk(userId)
    if (!user) return throwError(404, { message: 'User not found' })
    await user.update({ public_key: publicKey } as any)
    return { saved: true }
  }

  public async getPublicKey(userId: string) {
    const user = await UserRepository.findByPk(userId, {
      attributes: ['id', 'public_key'],
    })
    if (!user) return throwError(404, { message: 'User not found' })
    return { public_key: user.public_key ?? null }
  }

  public async saveFcmToken(userId: string, fcmToken: string, deviceId?: string) {
    logger.info(
      `[FCM] saveFcmToken called | userId=${userId} | deviceId=${deviceId || 'none'} | token=${fcmToken.substring(
        0,
        20,
      )}...`,
    )
    const where: any = deviceId ? { user_id: userId, device_id: deviceId } : { user_id: userId }
    const device = await DeviceRepository.findOne({ where, order: [['updated_at', 'DESC']] as any })
    if (!device) {
      logger.warn(`[FCM] saveFcmToken: no device found for userId=${userId} deviceId=${deviceId}`)
      return throwError(404, { message: 'Device not found' })
    }
    logger.info(`[FCM] saveFcmToken: updating device ${device.device_id}`)
    await device.update({ fcm_token: fcmToken } as any)
    return { saved: true }
  }

  public async deleteFcmToken(userId: string) {
    await DeviceRepository.update({ fcm_token: null } as any, { where: { user_id: userId } })
    return { deleted: true }
  }
}

export const userService = new UserService()
