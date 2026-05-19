// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfricasTalking = require('africastalking')
import { env } from './env.config'
import { logger } from '../helpers/logger'

const at = AfricasTalking({
  apiKey: env.AT_API_KEY,
  username: env.AT_USERNAME,
})

const sms = at.SMS

export async function sendSms(to: string, message: string): Promise<void> {
  try {
    await sms.send({ to: [to], message })
  } catch (err) {
    logger.error(`SMS delivery failed to ${to}: ${(err as Error).message}`)
    throw err
  }
}
