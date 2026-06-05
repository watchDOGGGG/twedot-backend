import crypto from 'crypto'
import { Response } from 'express'
import { asyncHandler } from '../../helpers'
import { getIo } from '../../config/socket.singleton'
import { redisClient } from '../../config/redis'
import { logger } from '../../helpers/logger'

export const sendMessageHttp = asyncHandler(async (req: any, res: Response) => {
  const senderId: string = req.user.id
  const { recipientId, content, messageType = 'text', clientMessageId, replyToId, isForwarded, chainRootId } = req.body

  if (!recipientId || !content) {
    return res.status(400).json({ success: false, message: 'recipientId and content are required' })
  }

  const { userService } = await import('../users/user.service')

  const isBlocked = await userService.isBlocked(recipientId, senderId)
  if (isBlocked) {
    return res.status(403).json({ success: false, message: 'Cannot send message' })
  }

  const [sender, recipient] = await Promise.all([
    userService.getUserById(senderId),
    userService.getUserById(recipientId),
  ])

  const message = {
    id: clientMessageId || `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
    clientMessageId: clientMessageId || null,
    senderId,
    senderName: sender?.name || null,
    senderPhone: sender?.phone_number || null,
    senderPhoto: sender?.profile_photo_url || null,
    senderRole: sender?.occupation || null,
    recipientId,
    // Included so the sender's device can show the correct contact name in the chatlist
    // without a race against offline_messages DB writes
    recipientName: recipient?.name || null,
    recipientPhoto: recipient?.profile_photo_url || null,
    recipientRole: recipient?.occupation || null,
    content,
    messageType,
    timestamp: new Date().toISOString(),
    status: 'sent',
    replyToId: replyToId || null,
    isForwarded: isForwarded === true,
    chainRootId: chainRootId || null,
  }

  const io = getIo()
  // Use live room membership (same as socket handler) — Redis key can be stale when the app
  // was killed and the TCP disconnect hasn't fired yet, causing messages to emit to a dead
  // socket and be silently lost (neither queued for offline nor triggering FCM).
  const recipientRoom = io?.sockets.adapter.rooms.get(`user:${recipientId}`)
  const recipientOnline = recipientRoom != null && recipientRoom.size > 0
  logger.info(`[HTTP send] recipient ${recipientId} is ${recipientOnline ? 'ONLINE' : 'OFFLINE'}`)

  if (recipientOnline && io) {
    io.to(`user:${recipientId}`).emit('receive_message', { ...message, status: 'delivered' })
    message.status = 'delivered'
  }

  // Always push to offline queue — even when the socket looks online, the app may be
  // backgrounded with JS suspended so the emit above is silently missed. The queue
  // ensures delivery via offline_messages / sync_messages_since on next foreground.
  // Client-side processedMessageIds + WatermelonDB duplicate-key handling prevent doubles.
  await redisClient.lPush(`messages:${recipientId}`, JSON.stringify(message))
  await redisClient.lTrim(`messages:${recipientId}`, 0, 499)
  await redisClient.expire(`messages:${recipientId}`, 604800)

  // Always send FCM — covers backgrounded apps where socket looks alive but isn't processing,
  // and foreground apps on a different screen. Frontend suppresses the notification if the
  // user is actively on that chat screen (same behaviour as the socket send_message path).
  import('../notifications/notification.service').then(({ notificationService }) => {
    notificationService.sendMessageNotification(recipientId, {
      senderName: message.senderName,
      senderId: message.senderId,
      messageType: message.messageType,
      content: message.content,
      caption: message.caption,
      isForwarded: message.isForwarded,
    }).catch((err) => logger.error('FCM error (http send):', err))
  }).catch((err) => logger.error('FCM import error (http send):', err))

  if (io) {
    const senderSocketId = await redisClient.get(`socket:${senderId}`)
    if (senderSocketId) {
      // Sender is online — deliver full message so chat screen adds it
      io.to(`user:${senderId}`).emit('notification_reply_sent', message)
    } else {
      // Sender is offline — queue full message for when they reconnect
      await redisClient.lPush(`sent_queue:${senderId}`, JSON.stringify(message))
      await redisClient.lTrim(`sent_queue:${senderId}`, 0, 499)
      await redisClient.expire(`sent_queue:${senderId}`, 604800)
    }
  }

  res.status(200).json({ success: true, data: message })
})
