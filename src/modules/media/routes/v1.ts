import { Router } from 'express'
import multer from 'multer'
import { mediaController } from '../media.controller'
import { authenticateToken } from '../../middleware/middleware'
import { validateBody } from '../../../helpers'
import { createUploadSessionSchema } from '../media.schema'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
})

router.post('/upload/session', authenticateToken, validateBody(createUploadSessionSchema), mediaController.createUploadSession)
router.post('/upload/:uploadId/chunk/:chunkIndex', authenticateToken, mediaController.uploadChunk)
router.get('/upload/:uploadId/progress', authenticateToken, mediaController.getUploadProgress)

// iOS native upload path — multipart POST, returns { jobId } immediately
router.post('/upload/direct', authenticateToken, upload.single('file'), mediaController.uploadDirect)

export const mediaRouterV1 = router
