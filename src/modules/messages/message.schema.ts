import { z } from 'zod'

const MESSAGE_TYPES = ['text', 'image', 'video', 'audio', 'document', 'location', 'status_reply', 'order', 'booking', 'item_reference', 'pickup_request'] as const

export const sendMessageSchema = z.object({
  recipientId: z.string().uuid('recipientId must be a valid UUID'),
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
  messageType: z.enum(MESSAGE_TYPES).optional().default('text'),
  clientMessageId: z.string().max(100).optional(),
  replyToId: z.string().optional(),
})
