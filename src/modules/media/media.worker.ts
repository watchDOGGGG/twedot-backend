import { Worker, Queue, Job } from 'bullmq'
import { env } from '../../config/env.config'
import { cloudinary } from '../../config/cloudinary.config'
import { redisClient } from '../../config/redis'
import { getIo } from '../../config/socket.singleton'
import { logger } from '../../helpers/logger'

export const MEDIA_UPLOAD_QUEUE = 'media-upload'

// BullMQ uses ioredis internally — connection is separate from the node-redis client above
const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null as any }

export const mediaUploadQueue = new Queue(MEDIA_UPLOAD_QUEUE, { connection })

// Cloudinary video URL → first-frame JPEG thumbnail (matches client-side derivation)
function deriveThumbnailUrl(url: string, mimeType: string): string {
  if (mimeType.startsWith('video/')) {
    return url
      .replace('/upload/', '/upload/so_0.1/')
      .replace(/\.(mp4|mov|webm|mkv)(\?.*)?$/i, '.jpg')
  }
  return url
}

export function startMediaWorker() {
  const worker = new Worker(
    MEDIA_UPLOAD_QUEUE,
    async (job: Job) => {
      const { userId, redisKey, fileName, mimeType } = job.data

      // Retrieve file buffer stored by the HTTP handler
      const bufferBase64 = await redisClient.get(redisKey)
      if (!bufferBase64) {
        throw new Error(`File buffer missing in Redis (key: ${redisKey})`)
      }

      const fileBuffer = Buffer.from(bufferBase64, 'base64')

      const isVideo = mimeType.startsWith('video/')
      const isAudio = mimeType.startsWith('audio/')
      const isImage = mimeType.startsWith('image/')
      const resourceType = isVideo || isAudio ? 'video' : isImage ? 'image' : 'raw'

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            public_id: `status/${job.id}/${fileName.split('.')[0]}`,
            overwrite: true,
            eager: isImage
              ? [{ width: 800, height: 800, crop: 'limit', quality: 'auto:good' }]
              : undefined,
            eager_async: isImage,
            unique_filename: true,
          },
          (err, result) => (err ? reject(err) : resolve(result)),
        )
        stream.end(fileBuffer)
      })

      // Clean up buffer immediately after successful upload
      await redisClient.del(redisKey).catch(() => {})

      const url: string = uploadResult.secure_url
      const thumbnailUrl = isImage
        ? uploadResult.eager?.[0]?.secure_url || url
        : deriveThumbnailUrl(url, mimeType)

      // Notify the uploading user's connected devices
      const io = getIo()
      if (io) {
        io.to(`user:${userId}`).emit('media_job_complete', {
          jobId: job.id,
          url,
          thumbnailUrl,
        })
      }

      logger.info(`media-upload job ${job.id} complete for user ${userId}`)
      return { url, thumbnailUrl }
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  )

  worker.on('failed', async (job, err) => {
    logger.error(`media-upload job ${job?.id} failed:`, err.message)
    // Always clean up the buffer — no point keeping it after failure
    if (job?.data?.redisKey) {
      await redisClient.del(job.data.redisKey).catch(() => {})
    }
  })

  logger.info('Media upload worker started')
  return worker
}
