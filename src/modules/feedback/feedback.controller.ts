import { asyncHandler, buildResponse } from '../../helpers'
import { Request } from 'express'
import { SubmitFeedbackPayload } from './feedback.interface'
import { feedbackService } from './feedback.service'

const { sendSuccessRes } = buildResponse

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    phone_number?: string
  }
}

class FeedbackController {
  private feedbackS = feedbackService

  public submitFeedback = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload: SubmitFeedbackPayload = {
      user_id: req.user!.id,
      issue_type: req.body.issue_type,
      description: req.body.description,
      image_url: req.body.image_url ?? null,
    }

    const response = await this.feedbackS.submitFeedback(payload)

    sendSuccessRes({
      data: response.feedback,
      statusCode: 201,
      message: response.message,
      res,
    })
  })
}

export const feedbackController = new FeedbackController()
