export interface SubmitFeedbackPayload {
  user_id: string
  issue_type: string
  description: string
  image_url?: string | null
}
