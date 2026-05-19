// backend/src/socket/socket.handler.ts
// Key fix: status_viewed now excludes the status owner from view count
// and uses per-viewer deduplication in the database

import crypto from 'crypto'
import { Server, Socket } from 'socket.io'
import { redisClient } from '../../config/redis'
import { logger } from '../../helpers/logger'

interface AuthSocket extends Socket {
  userId?: string
}

export class SocketHandler {
  private io: Server
  private redis = redisClient
  private msgRateLimits = new Map<string, { count: number; resetAt: number }>()

  constructor(io: Server) {
    this.io = io
    logger.info('SocketHandler initialized')
  }

  public start() {
    this.io.on('connection', (socket: AuthSocket) => {
      logger.info(`New connection attempt: ${socket.id}`)

      socket.on('authenticate', async (data: { token: string; deviceId: string }) => {
        try {
          const { userService } = await import('../users/user.service')

          const authToken = await userService.verifyToken(data.token)
          if (!authToken) {
            socket.emit('error', { message: 'Invalid token' })
            return socket.disconnect()
          }

          const isValidDevice = await userService.verifyDevice(authToken.user_id, data.deviceId)
          if (!isValidDevice) {
            socket.emit('error', { message: 'Invalid device' })
            return socket.disconnect()
          }

          socket.userId = authToken.user_id
          socket.join(`user:${authToken.user_id}`)

          await this.redis.setEx(`online:${authToken.user_id}`, 3600, socket.id)
          await this.redis.setEx(`socket:${authToken.user_id}`, 3600, socket.id)

          socket.emit('authenticated', { success: true })

          this.setupEvents(socket)

          setTimeout(() => {
            this.sendOfflineMessages(socket, authToken.user_id)
          }, 500)
        } catch (err) {
          logger.error(`Auth error on socket ${socket.id}:`, err as any)
          socket.emit('error', { message: 'Authentication failed' })
          socket.disconnect()
        }
      })

      socket.on('disconnect', () => {
        logger.info(`Socket ${socket.id} disconnected`)
      })
    })
  }

  private isMessageRateLimited(userId: string): boolean {
    const now = Date.now()
    const entry = this.msgRateLimits.get(userId)
    if (!entry || now > entry.resetAt) {
      this.msgRateLimits.set(userId, { count: 1, resetAt: now + 60_000 })
      return false
    }
    if (entry.count >= 60) return true
    entry.count++
    return false
  }

  private setupEvents(socket: AuthSocket) {
    socket.on('send_message', async (data) => {
      if (this.isMessageRateLimited(socket.userId!)) {
        socket.emit('error', { message: 'Too many messages. Please slow down.' })
        return
      }
      try {
        await this.sendMessage(socket, data)
      } catch (err) {
        logger.error(`Send message error:`, err as any)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    socket.on('status_update', async (data) => {
      try {
        await this.broadcastStatus(socket, data)
      } catch (err) {
        logger.error(`Status update error:`, err as any)
      }
    })

    /**
     * STATUS VIEWED
     * Critical: viewer must NOT be the status owner.
     * View count is per unique viewer (deduplication must happen in DB too).
     */
    socket.on('status_viewed', async (data: { statusId: string; statusOwnerId: string; viewCount: number }) => {
      try {
        // Guard: viewer cannot be the status owner
        if (socket.userId === data.statusOwnerId) {
          logger.info(`Owner ${socket.userId} tried to self-count view on status ${data.statusId} — blocked`)
          return
        }

        logger.info(
          `Status ${data.statusId} viewed by ${socket.userId} (owner: ${data.statusOwnerId}), count: ${data.viewCount}`,
        )

        // Notify the status owner in real-time
        this.io.to(`user:${data.statusOwnerId}`).emit('status_viewed_update', {
          statusId: data.statusId,
          viewerId: socket.userId,
          // viewerName: data.viewerName,
          viewCount: data.viewCount,
        })

        // Persist to DB (server-side dedup via unique constraint on status_id + viewer_id)
        try {
          const { statusService } = await import('../status/status.service')
          const result = await statusService.recordView(data.statusId, socket.userId!)
          // Re-broadcast authoritative server view count to status owner
          if (result) {
            this.io.to(`user:${data.statusOwnerId}`).emit('status_viewed_update', {
              statusId: data.statusId,
              viewerId: socket.userId,
              viewCount: result.viewCount,
            })
          }
        } catch (err) {
          // Non-fatal: client already has local count from earlier broadcast
          logger.error('Error persisting view to DB:', err as any)
        }
      } catch (err) {
        logger.error(`Status viewed error:`, err as any)
      }
    })

    socket.on('typing', async (data) => {
      const { userService } = await import('../users/user.service')
      const blocked = await userService.isBlocked(data.recipientId, socket.userId!)
      if (blocked) return
      socket.to(`user:${data.recipientId}`).emit('typing', {
        userId: socket.userId,
        isTyping: data.isTyping,
      })
    })

    socket.on('message_read', async (data) => {
      socket.to(`user:${data.senderId}`).emit('message_read', {
        messageId: data.messageId,
        readBy: socket.userId,
        readAt: new Date().toISOString(),
      })
    })

    socket.on('delete_message', async (data: { messageId: string; recipientId: string }) => {
      this.io.to(`user:${data.recipientId}`).emit('message_deleted', {
        messageId: data.messageId,
        deletedBy: socket.userId,
      })
    })

    socket.on('disconnect', async () => {
      if (!socket.userId) return
      await this.redis.setEx(`lastseen:${socket.userId}`, 86400, new Date().toISOString())
      await this.redis.del(`online:${socket.userId}`)
      await this.redis.del(`socket:${socket.userId}`)
    })
  }

  private async sendMessage(socket: AuthSocket, data: any) {
    const { userService } = await import('../users/user.service')
    const sender = await userService.getUserById(socket.userId!)

    const message = {
      id: data.clientMessageId || `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      clientMessageId: data.clientMessageId,
      senderId: socket.userId,
      senderName: sender?.name || null,
      senderPhone: sender?.phone_number || null,
      senderPhoto: sender?.profile_photo_url || null,
      senderRole: sender?.occupation || null,
      recipientId: data.recipientId,
      content: data.content,
      messageType: data.messageType || 'text',
      timestamp: new Date().toISOString(),
      status: 'sent',
      replyToId: data.replyToId,
      replySnapshot: data.replySnapshot,
      caption: data.caption,
      fileName: data.fileName,
      fileSize: data.fileSize,
      duration: data.duration,
    }

    // Don't deliver or acknowledge if recipient has blocked the sender
    const isBlocked = await userService.isBlocked(data.recipientId, socket.userId!)

    if (!isBlocked) {
      const recipientSocket = await this.redis.get(`socket:${data.recipientId}`)
      logger.info(`[Socket] recipientSocket for ${data.recipientId}: ${recipientSocket ? 'ONLINE' : 'OFFLINE'}`)
      if (recipientSocket) {
        this.io.to(`user:${data.recipientId}`).emit('receive_message', message)
        message.status = 'delivered'
      } else {
        await this.redis.lPush(`messages:${data.recipientId}`, JSON.stringify(message))
        await this.redis.lTrim(`messages:${data.recipientId}`, 0, 499)
        await this.redis.expire(`messages:${data.recipientId}`, 604800)
      }

      // Always send FCM push — frontend suppresses it if the user is actively on that chat screen.
      // This covers: backgrounded app (socket looks alive in Redis but app isn't processing),
      // and foreground app on a different screen (shows a banner).
      import('../notifications/notification.service').then(({ notificationService }) => {
        notificationService.sendMessageNotification(data.recipientId, {
          senderName: message.senderName,
          senderId: message.senderId as string,
          senderPhotoUrl: message.senderPhoto,
          messageType: message.messageType,
          content: message.content,
          caption: message.caption,
          replyToId: message.replyToId,
          replySnapshot: typeof message.replySnapshot === 'string'
            ? message.replySnapshot
            : message.replySnapshot ? JSON.stringify(message.replySnapshot) : undefined,
        }).catch((err) => logger.error(`FCM notification error: ${err?.message || err?.code || String(err)}`))
      }).catch((err) => logger.error(`FCM import error: ${err?.message || String(err)}`))
    }

    socket.emit('message_sent', message)
  }

  private async broadcastStatus(socket: AuthSocket, data: any) {
    const statusData = {
      id: data.id,
      userId: socket.userId, // Always use socket.userId, not client-provided
      userName: data.userName,
      userPhoto: data.userPhoto,
      type: data.type,
      content: data.content,
      caption: data.caption,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      isPrivate: data.isPrivate,
    }

    if (data.isPrivate) {
      if (data.targetUserIds && Array.isArray(data.targetUserIds) && data.targetUserIds.length > 0) {
        logger.info(`Broadcasting private status to ${data.targetUserIds.length} contacts`)

        for (const targetUserId of data.targetUserIds) {
          if (targetUserId === socket.userId) continue // Never send to self

          const targetSocket = await this.redis.get(`socket:${targetUserId}`)
          if (targetSocket) {
            this.io.to(`user:${targetUserId}`).emit('receive_message', {
              type: 'status_update',
              status: statusData,
            })
          } else {
            await this.redis.lPush(
              `status_queue:${targetUserId}`,
              JSON.stringify({
                type: 'status_update',
                status: statusData,
                receivedAt: new Date().toISOString(),
              }),
            )
            await this.redis.expire(`status_queue:${targetUserId}`, 86400)
            // FCM push for offline contact (fire-and-forget)
            if (statusData.userName) {
              import('../notifications/notification.service').then(({ notificationService }) => {
                notificationService.sendStatusNotification(
                  targetUserId,
                  statusData.userName,
                  statusData.userId as string,
                ).catch(() => {})
              }).catch(() => {})
            }
          }
        }
      }
    } else {
      // Public: broadcast by location
      logger.info(`Broadcasting public status from ${socket.userId}`)
      if (data.location) {
        try {
          const nearbyUsers = await this.getUsersByLocation(
            socket.userId!,
            data.location.country,
            data.location.state,
            data.location.city,
            data.location.latitude,
            data.location.longitude,
          )

          for (const user of nearbyUsers) {
            if (user.id === socket.userId) continue
            const targetSocket = await this.redis.get(`socket:${user.id}`)
            if (targetSocket) {
              this.io.to(`user:${user.id}`).emit('receive_message', {
                type: 'status_update',
                status: statusData,
              })
            } else {
              await this.redis.lPush(
                `status_queue:${user.id}`,
                JSON.stringify({
                  type: 'status_update',
                  status: statusData,
                  receivedAt: new Date().toISOString(),
                }),
              )
              await this.redis.expire(`status_queue:${user.id}`, 86400)
            }
          }
        } catch (err: any) {
          logger.error('Error broadcasting public status by location:', err)
        }
      } else {
        logger.warn(`Public status from ${socket.userId} dropped — no location provided`)
      }
    }

    socket.emit('status_created', { success: true, statusId: data.id })
  }

  private async getUsersByLocation(
    excludeUserId: string,
    country?: string,
    state?: string,
    city?: string,
    latitude?: number,
    longitude?: number,
  ): Promise<any[]> {
    const UserRepository = (await import('../users/repositories/user.repository')).default
    const { Op } = await import('sequelize')

    const whereClause: any = {
      id: { [Op.ne]: excludeUserId },
      is_verified: true,
      name: { [Op.ne]: null },
    }

    if (city) whereClause.city = city
    else if (country) whereClause.country = country

    if (latitude && longitude) {
      const query = `
        SELECT id, name, occupation, profile_photo_url, country, city, latitude, longitude,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
          ) / 1000 AS distance_km
        FROM users
        WHERE is_verified = true AND name IS NOT NULL
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND id != :excludeUserId
          ${city ? 'AND city = :city' : ''}
          ${country ? 'AND country = :country' : ''}
        ORDER BY distance_km ASC LIMIT 200
      `
      const users = await UserRepository.sequelize!.query(query, {
        replacements: { lat: latitude, lng: longitude, excludeUserId, city: city || null, country: country || null },
        type: 'SELECT',
        raw: true,
      })
      return users as any[]
    }

    const users = await UserRepository.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'profile_photo_url', 'city', 'country'],
      limit: 200,
    })
    return users.map((u: any) => ({ id: u.id, name: u.name, city: u.city, country: u.country }))
  }

  private async sendOfflineMessages(socket: AuthSocket, userId: string) {
    const messages = await this.redis.lRange(`messages:${userId}`, 0, -1)
    if (messages.length > 0) {
      socket.emit('offline_messages', messages.map((m) => JSON.parse(m)))
      await this.redis.del(`messages:${userId}`)
    }

    // Messages this user sent via notification reply while offline
    const sentMessages = await this.redis.lRange(`sent_queue:${userId}`, 0, -1)
    if (sentMessages.length > 0) {
      for (const m of sentMessages) {
        socket.emit('notification_reply_sent', JSON.parse(m))
      }
      await this.redis.del(`sent_queue:${userId}`)
    }

    const statuses = await this.redis.lRange(`status_queue:${userId}`, 0, -1)
    if (statuses.length > 0) {
      logger.info(`Delivering ${statuses.length} queued statuses to ${userId}`)
      for (const statusStr of statuses) {
        try {
          socket.emit('receive_message', JSON.parse(statusStr))
        } catch (e) {}
      }
      await this.redis.del(`status_queue:${userId}`)
    }

    // Queued chain-delete events (delete_by_chain while recipient was offline)
    const chainDeletes = await this.redis.lRange(`chain_deletes:${userId}`, 0, -1)
    if (chainDeletes.length > 0) {
      for (const chainRootId of chainDeletes) {
        socket.emit('delete_by_chain', { chainRootId })
      }
      await this.redis.del(`chain_deletes:${userId}`)
    }

    // Protected message notifications queued while recipient was offline
    const protectedMsgs = await this.redis.lRange(`protected_msgs:${userId}`, 0, -1)
    if (protectedMsgs.length > 0) {
      for (const messageId of protectedMsgs) {
        socket.emit('message_protected', { messageId })
      }
      await this.redis.del(`protected_msgs:${userId}`)
    }

    // Protection-removed notifications queued while recipient was offline
    const unprotectedMsgs = await this.redis.lRange(`unprotected_msgs:${userId}`, 0, -1)
    if (unprotectedMsgs.length > 0) {
      for (const messageId of unprotectedMsgs) {
        socket.emit('message_unprotected', { messageId })
      }
      await this.redis.del(`unprotected_msgs:${userId}`)
    }

    // Queued forward count updates (badge increments while sender was offline)
    const forwardUpdates = await this.redis.lRange(`forward_updates:${userId}`, 0, -1)
    if (forwardUpdates.length > 0) {
      // Collapse to latest count per messageId — last write wins
      const latestByMessage = new Map<string, number>()
      for (const raw of forwardUpdates) {
        try {
          const { messageId, forwardCount } = JSON.parse(raw)
          latestByMessage.set(messageId, forwardCount)
        } catch {}
      }
      for (const [messageId, forwardCount] of latestByMessage) {
        socket.emit('forward_count_update', { messageId, forwardCount })
      }
      await this.redis.del(`forward_updates:${userId}`)
    }
  }
}
