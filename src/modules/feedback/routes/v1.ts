import { Router } from 'express'
import { feedbackController } from '../feedback.controller'
import { authenticateToken } from '../../middleware/middleware'
import { validateBody } from '../../../helpers'
import { submitFeedbackSchema } from '../feedback.schema'

const router = Router()

router.use(authenticateToken)

router.post('/', validateBody(submitFeedbackSchema), feedbackController.submitFeedback)

export const feedbackRouterV1 = router
