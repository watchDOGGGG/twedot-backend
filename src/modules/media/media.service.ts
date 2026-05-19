import { redisClient } from '../../config/redis'
import { cloudinary } from '../../config/cloudinary.config'
import crypto from 'crypto'
import { throwError } from '../../helpers'

interface ChunkMetadata {
  uploadId: string
  quickHash: string
  fullHash: string
  totalChunks: number
  receivedChunks: number[]
  fileName: string
  mimeType: string
  fileSize: number
  uploadedAt: number
}

interface UploadResult {
  url: string
  thumbnailUrl: string
  publicId: string
  width: number
  height: number
  format: string
  resourceType: string
  progress: number
  complete: boolean
}

class MediaService {
  private readonly CHUNK_TTL = 3600
  private readonly RESULT_TTL = 300
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024

  public async createUploadSession(
    quickHash: string,
    fullHash: string,
    totalChunks: number,
    fileName: string,
    mimeType: string,
    fileSize: number,
  ) {
    const existingUrl = await this.checkDuplicateHash(quickHash)
    if (existingUrl) {
      return {
        duplicate: true,
        url: existingUrl,
        uploadId: null,
      }
    }

    if (fileSize > this.MAX_FILE_SIZE) {
      return throwError(413, { message: 'File too large. Max 100MB allowed.' })
    }

    const uploadId = crypto.randomUUID()
    const metadata: ChunkMetadata = {
      uploadId,
      quickHash,
      fullHash,
      totalChunks,
      receivedChunks: [],
      fileName,
      mimeType,
      fileSize,
      uploadedAt: Date.now(),
    }

    await redisClient.setEx(`upload:${uploadId}`, this.CHUNK_TTL, JSON.stringify(metadata))

    return {
      duplicate: false,
      uploadId,
    }
  }

  private async checkDuplicateHash(quickHash: string): Promise<string | null> {
    const existing = await redisClient.get(`filehash:${quickHash}`)
    return existing
  }

  public async storeChunk(uploadId: string, chunkIndex: number, chunkData: Buffer) {
    const metadataKey = `upload:${uploadId}`
    const stored = await redisClient.get(metadataKey)

    if (!stored) {
      return throwError(404, { message: 'Upload session not found or expired' })
    }

    const data = JSON.parse(stored)

    if (data.result) {
      return { status: 'complete', ...data.result }
    }

    const metadata: ChunkMetadata = data

    if (chunkIndex >= metadata.totalChunks) {
      return throwError(400, { message: 'Invalid chunk index' })
    }

    if (metadata.receivedChunks.includes(chunkIndex)) {
      return { status: 'already_received', progress: this.calculateProgress(metadata) }
    }

    const chunkKey = `chunk:${uploadId}:${chunkIndex}`
    await redisClient.setEx(chunkKey, this.CHUNK_TTL, chunkData.toString('base64'))

    metadata.receivedChunks.push(chunkIndex)

    const progress = this.calculateProgress(metadata)

    if (progress === 100) {
      const result = await this.assembleAndUpload(uploadId, metadata)
      return { status: 'complete', ...result }
    }

    await redisClient.setEx(metadataKey, this.CHUNK_TTL, JSON.stringify(metadata))
    return { status: 'received', progress }
  }

  private calculateProgress(metadata: ChunkMetadata): number {
    return Math.round((metadata.receivedChunks.length / metadata.totalChunks) * 100)
  }

  private async assembleAndUpload(uploadId: string, metadata: ChunkMetadata) {
  const chunks: Buffer[] = []

  for (let i = 0; i < metadata.totalChunks; i++) {
    const chunkKey = `chunk:${uploadId}:${i}`
    const chunkBase64 = await redisClient.get(chunkKey)
    if (!chunkBase64) {
      throw new Error(`Missing chunk ${i}`)
    }
    chunks.push(Buffer.from(chunkBase64, 'base64'))
  }

  const fileBuffer = Buffer.concat(chunks)
  const fullBase64 = fileBuffer.toString('base64')

  if (metadata.fileSize > 10240) {
    const computedHash = crypto.createHash('sha256').update(fullBase64).digest('hex')
    if (computedHash !== metadata.fullHash) {
      return throwError(400, { message: 'File integrity check failed' })
    }
  }

  // FIXED: Handle all resource types properly
  const isVideo = metadata.mimeType.startsWith('video/')
  const isAudio = metadata.mimeType.startsWith('audio/')
  const isImage = metadata.mimeType.startsWith('image/')
  const resourceType = isVideo || isAudio ? 'video' : isImage ? 'image' : 'raw'

  const uploadResult = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: `inventory/${uploadId}/${metadata.fileName.split('.')[0]}`,
        overwrite: true,
        // Only eager transformations for images
        eager: isImage 
          ? [
              { width: 800, height: 800, crop: 'limit', quality: 'auto:good' },
              { width: 300, height: 300, crop: 'fill', quality: 'auto:eco' },
            ]
          : undefined,
        eager_async: isImage,
        // Preserve original filename for documents
        use_filename: resourceType === 'raw',
        unique_filename: resourceType !== 'raw',
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )

    uploadStream.end(fileBuffer)
  })

  const result: UploadResult = {
    url: uploadResult.secure_url,
    thumbnailUrl: isImage 
      ? (uploadResult.eager?.[0]?.secure_url || uploadResult.secure_url)
      : uploadResult.secure_url,
    publicId: uploadResult.public_id,
    width: uploadResult.width || 0,
    height: uploadResult.height || 0,
    format: uploadResult.format,
    resourceType,
    progress: 100,
    complete: true,
  }

  await this.cleanupChunks(uploadId, metadata.totalChunks)

  await redisClient.setEx(
    `upload:${uploadId}`,
    this.RESULT_TTL,
    JSON.stringify({
      ...metadata,
      result,
    }),
  )

  await redisClient.setEx(`filehash:${metadata.quickHash}`, 86400 * 30, uploadResult.secure_url)

  return result
}

  private async cleanupChunks(uploadId: string, totalChunks: number) {
    const pipeline = redisClient.multi()
    for (let i = 0; i < totalChunks; i++) {
      pipeline.del(`chunk:${uploadId}:${i}`)
    }
    await pipeline.exec()
  }

  public async getUploadProgress(uploadId: string) {
    const stored = await redisClient.get(`upload:${uploadId}`)
    if (!stored) {
      return throwError(404, { message: 'Upload session not found' })
    }

    const data = JSON.parse(stored)

    if (data.result) {
      return data.result
    }

    const metadata: ChunkMetadata = data
    return {
      progress: this.calculateProgress(metadata),
      receivedChunks: metadata.receivedChunks.length,
      totalChunks: metadata.totalChunks,
    }
  }

  public async deleteFromCloudinary(publicId: string, resourceType: string = 'image') {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
      return true
    } catch (error) {
      console.error('Cloudinary delete error:', error)
      return false
    }
  }
}

export const mediaService = new MediaService()
