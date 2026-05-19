import { asyncHandler, buildResponse } from '../../helpers'
import { Request, Response } from 'express'
import { mediaService } from './media.service'

const { sendSuccessRes } = buildResponse

class MediaController {
  public createUploadSession = asyncHandler(async (req: Request, res: Response) => {
    const { quickHash, fullHash, totalChunks, fileName, mimeType, fileSize } = req.body

    const result = await mediaService.createUploadSession(
      quickHash,
      fullHash,
      totalChunks,
      fileName,
      mimeType,
      fileSize,
    )

    sendSuccessRes({
      data: result,
      statusCode: result.duplicate ? 200 : 201,
      message: result.duplicate ? 'File already exists' : 'Upload session created',
      res,
    })
  })

  public uploadChunk = asyncHandler(async (req: Request, res: Response) => {
    const { uploadId, chunkIndex } = req.params
    const { chunk } = req.body

    if (!chunk || typeof chunk !== 'string') {
      return sendSuccessRes({
        data: { error: 'No chunk provided' },
        statusCode: 400,
        message: 'Chunk data required',
        res,
      })
    }

    const chunkBuffer = Buffer.from(chunk, 'base64')

    const result = await mediaService.storeChunk(uploadId, parseInt(chunkIndex), chunkBuffer)

    sendSuccessRes({
      data: result,
      statusCode: 200,
      message: 'Chunk processed',
      res,
    })
  })

  public getUploadProgress = asyncHandler(async (req: Request, res: Response) => {
    const { uploadId } = req.params
    const result = await mediaService.getUploadProgress(uploadId)

    sendSuccessRes({
      data: result,
      statusCode: 200,
      message: 'Progress retrieved',
      res,
    })
  })
}

export const mediaController = new MediaController()
