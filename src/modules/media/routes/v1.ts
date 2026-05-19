import { Router } from 'express'
import { mediaController } from '../media.controller'
import { authenticateToken } from '../../middleware/middleware'
import { validateBody } from '../../../helpers'
import { createUploadSessionSchema } from '../media.schema'

const router = Router()

router.post('/upload/session', authenticateToken, validateBody(createUploadSessionSchema), mediaController.createUploadSession)
router.post('/upload/:uploadId/chunk/:chunkIndex', authenticateToken, mediaController.uploadChunk)
router.get('/upload/:uploadId/progress', authenticateToken, mediaController.getUploadProgress)

export const mediaRouterV1 = router
