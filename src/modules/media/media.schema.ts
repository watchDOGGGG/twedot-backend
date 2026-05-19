import { z } from 'zod'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'audio/mp4',
  'application/pdf',
] as const

const MAX_FILE_SIZE: Record<string, number> = {
  'image/': 10 * 1024 * 1024,        // 10 MB
  'video/': 100 * 1024 * 1024,       // 100 MB
  'audio/': 20 * 1024 * 1024,        // 20 MB
  'application/': 10 * 1024 * 1024,  // 10 MB
}

export const createUploadSessionSchema = z
  .object({
    quickHash: z.string().min(1).max(256),
    fullHash: z.string().min(1).max(256),
    totalChunks: z.number().int().min(1).max(10000),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({ message: 'Unsupported file type' }),
    }),
    fileSize: z.number().int().min(1),
  })
  .refine(
    (data) => {
      const prefix = Object.keys(MAX_FILE_SIZE).find((p) => data.mimeType.startsWith(p))
      const limit = prefix ? MAX_FILE_SIZE[prefix] : 10 * 1024 * 1024
      return data.fileSize <= limit
    },
    { message: 'File size exceeds the limit for this file type', path: ['fileSize'] },
  )

export { ALLOWED_MIME_TYPES }
