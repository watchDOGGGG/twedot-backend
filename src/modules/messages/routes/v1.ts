import { Router } from 'express'
import { authenticateToken } from '../../middleware/middleware'
import { sendMessageHttp } from '../message.controller'
import { validateBody } from '../../../helpers'
import { sendMessageSchema } from '../message.schema'

const router = Router()

router.use(authenticateToken)
router.post('/send', validateBody(sendMessageSchema), sendMessageHttp)

export const messagesRouterV1 = router
