// backend/src/modules/notifications/notification.service.ts
import { getFirebaseAdmin } from '../../config/firebase.config'
import { logger } from '../../helpers/logger'

export type NotificationType = 'new_message' | 'new_status' | 'app_update'

interface MessagePayload {
  senderName: string | null
  senderId: string
  senderPhotoUrl?: string | null
  messageType: string
  content?: string
  caption?: string
  replyToId?: string
  replySnapshot?: string
}

class NotificationService {
  private async getFcmToken(userId: string): Promise<string | null> {
    try {
      const DeviceRepository = (await import('../users/repositories/user.deviceinfo.repository')).default
      const device = await DeviceRepository.findOne({
        where: { user_id: userId } as any,
        order: [['updated_at', 'DESC']] as any,
      })
      const token = (device as any)?.fcm_token ?? null
      logger.info(`[FCM] token for user ${userId}: ${token ? 'found' : 'NOT FOUND'}`)
      return token && token.length > 0 ? token : null
    } catch (err: any) {
      logger.error(`[FCM] getFcmToken error for user ${userId}: ${err?.message || String(err)}`)
      return null
    }
  }

  /**
   * Send a data-only FCM message (used for status notifications and app updates).
   * All values in `data` must be strings.
   */
  private async sendDataMessage(fcmToken: string, userId: string, data: Record<string, string>, opts?: {
    priority?: 'high' | 'normal'
    collapseKey?: string
  }) {
    const app = await getFirebaseAdmin()
    if (!app) return

    const admin = await import('firebase-admin')
    logger.info(`[FCM] Sending data-only to user ${userId}`)
    try {
      const messageId = await admin.messaging(app).send({
        token: fcmToken,
        data,
        android: {
          priority: opts?.priority === 'high' ? 'high' : 'normal',
          collapseKey: opts?.collapseKey,
        },
        apns: {
          headers: {
            'apns-push-type': 'background',
            'apns-priority': '5',
            ...(opts?.collapseKey ? { 'apns-collapse-id': opts.collapseKey } : {}),
          },
          payload: { aps: { 'content-available': 1 } },
        },
      })
      logger.info(`[FCM] Delivered | messageId=${messageId} | user=${userId}`)
    } catch (err: any) {
      logger.error(`[FCM] send error for user ${userId} | code=${err?.code} | msg=${err?.message}`)
    }
  }

  /**
   * Send a notification+data FCM message for chat messages.
   * The notification field guarantees system-level display even when the app is killed
   * (no JS execution required). When app is foreground, onMessage intercepts it so
   * notifee shows the enhanced notification with Reply/Mark-as-Read buttons instead.
   */
  private async sendNotificationMessage(fcmToken: string, userId: string, title: string, body: string, data: Record<string, string>, opts?: {
    collapseKey?: string
  }) {
    const app = await getFirebaseAdmin()
    if (!app) return

    const admin = await import('firebase-admin')
    logger.info(`[FCM] Sending notification to user ${userId}`)
    try {
      const messageId = await admin.messaging(app).send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          collapseKey: opts?.collapseKey,
          notification: {
            channelId: 'messages',
            color: '#6B4EFF',
            // tag groups notifications from the same sender so Android replaces
            // the existing notification instead of stacking new ones
            tag: opts?.collapseKey,
          },
        },
        apns: {
          headers: {
            ...(opts?.collapseKey ? { 'apns-collapse-id': opts.collapseKey } : {}),
          },
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      })
      logger.info(`[FCM] Delivered | messageId=${messageId} | user=${userId}`)
    } catch (err: any) {
      logger.error(`[FCM] send error for user ${userId} | code=${err?.code} | msg=${err?.message}`)
    }
  }

  public async sendMessageNotification(recipientId: string, payload: MessagePayload) {
    logger.info(`[FCM] sendMessageNotification → recipientId: ${recipientId}`)
    const fcmToken = await this.getFcmToken(recipientId)
    if (!fcmToken) {
      logger.warn(`[FCM] No token for ${recipientId} — skipping push`)
      return
    }

    const body = payload.replyToId
      ? this.getReplyBody(payload)
      : this.getMessageBody(payload)

    const data: Record<string, string> = {
      type: 'new_message',
      senderId: payload.senderId,
      senderName: payload.senderName || '',
      senderPhotoUrl: payload.senderPhotoUrl || '',
      messageType: payload.messageType,
      body,
    }

    // Pass media URL so the recipient's device can show a BigPicture banner
    if (payload.messageType === 'image' || payload.messageType === 'video' || payload.messageType === 'sticker') {
      const url = payload.content || ''
      if (url.startsWith('http://') || url.startsWith('https://')) data.mediaUrl = url
    } else if (
      payload.messageType === 'booking' ||
      payload.messageType === 'order' ||
      payload.messageType === 'item_reference' ||
      payload.messageType === 'pickup_request'
    ) {
      try {
        const parsed = JSON.parse(payload.content || '{}')
        const thumb = parsed.imageUrl || parsed.thumbnail || parsed.photo_url || parsed.image || ''
        if (thumb) data.mediaUrl = thumb
      } catch {}
    }

    await this.sendNotificationMessage(
      fcmToken,
      recipientId,
      payload.senderName || 'New Message',
      body,
      data,
      { collapseKey: `chat_${payload.senderId}` },
    )
  }

  public async sendStatusNotification(recipientId: string, senderName: string, senderId: string) {
    const fcmToken = await this.getFcmToken(recipientId)
    if (!fcmToken) return

    await this.sendDataMessage(fcmToken, recipientId, {
      type: 'new_status',
      senderId,
      senderName,
    }, {
      priority: 'normal',
    })
  }

  public async sendAppUpdateNotification(userIds: string[], version: string, releaseNotes?: string) {
    for (const userId of userIds) {
      const fcmToken = await this.getFcmToken(userId)
      if (!fcmToken) continue

      await this.sendDataMessage(fcmToken, userId, {
        type: 'app_update',
        version,
        body: releaseNotes || `Version ${version} is available. Update now!`,
      })
    }
  }

  private getMessageBody(payload: MessagePayload): string {
    switch (payload.messageType) {
      case 'image': return payload.caption ? `📷 ${payload.caption}` : '📷 Photo'
      case 'video': return payload.caption ? `🎥 ${payload.caption}` : '🎥 Video'
      case 'audio':
      case 'voice': return '🎵 Voice message'
      case 'document': return '📄 Document'
      case 'contact': {
        try { return `👤 ${JSON.parse(payload.content || '{}').name || 'Contact'}` } catch { return '👤 Contact' }
      }
      case 'item_reference': {
        try { return `📦 ${JSON.parse(payload.content || '{}').title || 'Item'}` } catch { return '📦 Item' }
      }
      case 'order': {
        try {
          const o = JSON.parse(payload.content || '{}')
          return `🛒 Order request: ${o.itemTitle || 'Item'}${o.quantity ? ` (×${o.quantity})` : ''}`
        } catch { return '🛒 Order request' }
      }
      case 'booking': {
        try { return `📅 Booking request: ${JSON.parse(payload.content || '{}').itemTitle || 'Service'}` } catch { return '📅 Booking request' }
      }
      case 'pickup_request': {
        try { return `🚗 Pickup request: ${JSON.parse(payload.content || '{}').itemTitle || 'Item'}` } catch { return '🚗 Pickup request' }
      }
      case 'sticker': return '🎭 Sticker'
      default: {
        const text = payload.content || 'New message'
        if (text.startsWith('http://') || text.startsWith('https://')) return '📎 Attachment'
        return text.length > 120 ? text.substring(0, 120) + '…' : text
      }
    }
  }

  private getReplyBody(payload: MessagePayload): string {
    let originalContext = 'your message'
    if (payload.replySnapshot) {
      try {
        const snap = JSON.parse(payload.replySnapshot)
        switch (snap?.type) {
          case 'image': originalContext = 'your photo'; break
          case 'video': originalContext = 'your video'; break
          case 'audio':
          case 'voice': originalContext = 'your voice message'; break
          case 'document': originalContext = 'your document'; break
          case 'order': originalContext = 'your order'; break
          case 'booking': originalContext = 'your booking'; break
          case 'item_reference': originalContext = 'your item'; break
          case 'pickup_request': originalContext = 'your pickup request'; break
          case 'sticker': originalContext = 'your sticker'; break
          default: {
            const snip = String(snap?.content || '').trim()
            if (snip && !snip.startsWith('http')) {
              originalContext = `"${snip.substring(0, 40)}${snip.length > 40 ? '…' : ''}"`
            }
          }
        }
      } catch {}
    }
    return `↩ Replied to ${originalContext}: ${this.getMessageBody(payload)}`
  }
}

export const notificationService = new NotificationService()
