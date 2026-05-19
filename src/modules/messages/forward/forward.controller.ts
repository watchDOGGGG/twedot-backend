// backend/src/modules/messages/forward/forward.controller.ts
import { Response } from 'express'
import { asyncHandler } from '../../../helpers'
import { getIo } from '../../../config/socket.singleton'
import { redisClient } from '../../../config/redis'
import { logger } from '../../../helpers/logger'

const getDb = async () => {
  const { default: sequelize } = await import('../../../config/db-config/sequelize.instance')
  return sequelize
}

// POST /messages/mark-important
// Body: { messageId, recipientId }
// Marks the caller's sent message as important — starts tracking forwards from this point.
// Also notifies the recipient so their client can block forwarding.
export const markImportant = asyncHandler(async (req: any, res: Response) => {
  const senderId: string = req.user.id
  const { messageId, recipientId } = req.body

  if (!messageId) {
    return res.status(400).json({ success: false, message: 'messageId is required' })
  }

  const db = await getDb()
  await db.query(
    `INSERT INTO important_messages (id, message_id, original_sender_id, original_recipient_id, forward_count, created_at, updated_at)
     VALUES (gen_random_uuid(), :messageId, :senderId, :recipientId, 0, NOW(), NOW())
     ON CONFLICT (message_id) DO NOTHING`,
    { replacements: { messageId, senderId, recipientId: recipientId || null }, type: 'INSERT' as any },
  )

  // Notify recipient so their client marks the message as protected (blocks forwarding)
  if (recipientId) {
    const io = getIo()
    const recipientSocket = await redisClient.get(`socket:${recipientId}`)
    if (recipientSocket && io) {
      io.to(`user:${recipientId}`).emit('message_protected', { messageId })
    } else {
      // Queue for when recipient comes online
      await redisClient.lPush(`protected_msgs:${recipientId}`, messageId)
      await redisClient.expire(`protected_msgs:${recipientId}`, 604800)
    }
  }

  logger.info(`[Forward] Message ${messageId} marked important by ${senderId}`)
  res.status(200).json({ success: true, message: 'Message marked as important' })
})

// POST /messages/forward
// Body: { originalMessageId, chainRootId, recipientId, hopMessageId }
// Always records the hop so delete-everywhere can find all recipients.
// Also increments badge count if the chain root is marked important.
export const recordForward = asyncHandler(async (req: any, res: Response) => {
  const forwarderId: string = req.user.id
  const { originalMessageId, chainRootId, recipientId, hopMessageId } = req.body

  if (!originalMessageId || !recipientId || !hopMessageId) {
    return res.status(400).json({ success: false, message: 'originalMessageId, recipientId and hopMessageId are required' })
  }

  const rootId = chainRootId || originalMessageId
  const db = await getDb()

  // Always record the hop — needed for delete-everywhere regardless of importance.
  // original_sender_id falls back to forwarderId if not an important chain.
  await db.query(
    `INSERT INTO forward_records (id, chain_root_id, original_sender_id, forwarder_id, recipient_id, hop_message_id, created_at, updated_at)
     VALUES (
       gen_random_uuid(), :rootId,
       COALESCE((SELECT original_sender_id FROM important_messages WHERE message_id = :rootId LIMIT 1), :forwarderId),
       :forwarderId, :recipientId, :hopMessageId, NOW(), NOW()
     )`,
    { replacements: { rootId, forwarderId, recipientId, hopMessageId }, type: 'INSERT' as any },
  )

  // Check if important → update badge count and notify original sender
  const [rows]: any = await db.query(
    `SELECT id, original_sender_id, forward_count FROM important_messages WHERE message_id = :rootId LIMIT 1`,
    { replacements: { rootId }, type: 'SELECT' as any },
  )
  const importantRecord = Array.isArray(rows) ? rows[0] : undefined

  if (importantRecord) {
    const originalSenderId = importantRecord.original_sender_id
    const newCount = (importantRecord.forward_count || 0) + 1

    await db.query(
      `UPDATE important_messages SET forward_count = :newCount, updated_at = NOW() WHERE message_id = :rootId`,
      { replacements: { newCount, rootId }, type: 'UPDATE' as any },
    )

    const io = getIo()
    const senderSocketId = await redisClient.get(`socket:${originalSenderId}`)
    if (senderSocketId && io) {
      io.to(`user:${originalSenderId}`).emit('forward_count_update', { messageId: rootId, forwardCount: newCount })
    } else {
      await redisClient.lPush(`forward_updates:${originalSenderId}`, JSON.stringify({ messageId: rootId, forwardCount: newCount }))
      await redisClient.expire(`forward_updates:${originalSenderId}`, 604800)
    }

    logger.info(`[Forward] Important message ${rootId} forwarded. Count: ${newCount}`)
  }

  res.status(200).json({ success: true, message: 'Forward recorded' })
})

// POST /messages/remove-protection
// Body: { messageId, recipientId }
// Removes importance flag — recipient's forward button re-enables.
export const removeProtection = asyncHandler(async (req: any, res: Response) => {
  const senderId: string = req.user.id
  const { messageId, recipientId } = req.body

  if (!messageId) {
    return res.status(400).json({ success: false, message: 'messageId is required' })
  }

  const db = await getDb()
  await db.query(
    `DELETE FROM important_messages WHERE message_id = :messageId AND original_sender_id = :senderId`,
    { replacements: { messageId, senderId }, type: 'DELETE' as any },
  )

  // Notify recipient they can now forward
  if (recipientId) {
    const io = getIo()
    const recipientSocket = await redisClient.get(`socket:${recipientId}`)
    if (recipientSocket && io) {
      io.to(`user:${recipientId}`).emit('message_unprotected', { messageId })
    } else {
      await redisClient.lPush(`unprotected_msgs:${recipientId}`, messageId)
      await redisClient.expire(`unprotected_msgs:${recipientId}`, 604800)
    }
  }

  logger.info(`[Forward] Protection removed from message ${messageId} by ${senderId}`)
  res.status(200).json({ success: true, message: 'Protection removed' })
})

// POST /messages/delete-forwarded
// Body: { messageId, recipientId }
// Broadcasts chainRootId to all known recipients. Each device queries its own local DB
// for messages with chain_root_id = chainRootId (or id = chainRootId) and deletes them.
export const deleteForwardChain = asyncHandler(async (req: any, res: Response) => {
  const senderId: string = req.user.id
  const { messageId, recipientId } = req.body

  if (!messageId) {
    return res.status(400).json({ success: false, message: 'messageId is required' })
  }

  const io = getIo()
  const chainRootId = messageId

  const notifyRecipient = async (targetId: string) => {
    io?.to(`user:${targetId}`).emit('delete_by_chain', { chainRootId })
    const isOnline = await redisClient.get(`socket:${targetId}`)
    if (!isOnline) {
      await redisClient.lPush(`chain_deletes:${targetId}`, chainRootId)
      await redisClient.expire(`chain_deletes:${targetId}`, 604800)
    }
  }

  // Always notify the direct recipient using chainRootId — their device will find and delete locally
  if (recipientId) {
    await notifyRecipient(recipientId)
    logger.info(`[Forward] delete_by_chain → direct recipient ${recipientId} (chain: ${chainRootId})`)
  }

  try {
    const db = await getDb()

    // Get all unique recipients who ever received a hop in this chain
    const [hops]: any = await db.query(
      `SELECT DISTINCT recipient_id FROM forward_records WHERE chain_root_id = :chainRootId`,
      { replacements: { chainRootId }, type: 'SELECT' as any },
    )
    const hopList: any[] = Array.isArray(hops) ? hops : []

    for (const hop of hopList) {
      if (hop.recipient_id === recipientId) continue  // already emitted above
      await notifyRecipient(hop.recipient_id)
      logger.info(`[Forward] delete_by_chain → hop recipient ${hop.recipient_id} (chain: ${chainRootId})`)
    }

    // Clean up tracking records
    await db.query(`DELETE FROM forward_records WHERE chain_root_id = :chainRootId`, { replacements: { chainRootId }, type: 'DELETE' as any })
    await db.query(`DELETE FROM important_messages WHERE message_id = :chainRootId AND original_sender_id = :senderId`, { replacements: { chainRootId, senderId }, type: 'DELETE' as any })

    logger.info(`[Forward] Chain ${chainRootId} deleted — notified ${hopList.length} hop recipients`)
  } catch (err) {
    logger.error(`[Forward] DB cleanup error (non-fatal):`, err as any)
  }

  res.status(200).json({ success: true, message: 'Message deleted everywhere' })
})
