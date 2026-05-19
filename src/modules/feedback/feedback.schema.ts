import { z } from 'zod'

export const submitFeedbackSchema = z.object({
  issue_type: z.string().min(1, 'Issue type is required').max(100),
  description: z.string().min(1, 'Description is required').max(2000),
  image_url: z.string().url().optional().nullable(),
})
