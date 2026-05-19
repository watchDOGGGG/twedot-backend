import { Router } from 'express'
import { authenticateToken } from '../../middleware/middleware'
import { markImportant, recordForward, deleteForwardChain, removeProtection } from './forward.controller'

const router = Router()

router.use(authenticateToken)
router.post('/mark-important', markImportant)
router.post('/forward', recordForward)
router.post('/delete-forwarded', deleteForwardChain)
router.post('/remove-protection', removeProtection)

export const forwardRouterV1 = router
