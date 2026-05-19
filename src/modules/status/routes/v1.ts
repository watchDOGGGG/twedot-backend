import { Router } from 'express'
import { authenticateToken } from '../../middleware/middleware'
import { statusController } from '../status.controller'

const statusRouterV1 = Router()

statusRouterV1.use(authenticateToken)

statusRouterV1.post('/', statusController.createStatus)
statusRouterV1.get('/private', statusController.getPrivateStatuses)
statusRouterV1.get('/public', statusController.getPublicStatuses)
statusRouterV1.get('/me', statusController.getMyStatuses)
statusRouterV1.post('/:statusId/view', statusController.markAsViewed)
statusRouterV1.get('/:statusId/viewers', statusController.getViewers)
statusRouterV1.delete('/:statusId', statusController.deleteStatus)

export { statusRouterV1 }