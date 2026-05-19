import FeedbackRepository from './feedback.repository'
import { SubmitFeedbackPayload } from './feedback.interface'

class FeedbackService {
  async submitFeedback(payload: SubmitFeedbackPayload) {
    const feedback = await FeedbackRepository.create({
      user_id: payload.user_id,
      issue_type: payload.issue_type,
      description: payload.description,
      image_url: payload.image_url ?? null,
    })

    return { message: 'Feedback submitted successfully', feedback }
  }
}

export const feedbackService = new FeedbackService()
