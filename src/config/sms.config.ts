import { env } from './env.config'
import { logger } from '../helpers/logger'

export async function sendSms(to: string, message: string): Promise<void> {
  const url = `https://${env.INFOBIP_BASE_URL}/sms/2/text/advanced`

  const body = JSON.stringify({
    messages: [
      {
        destinations: [{ to }],
        from: 'Twedot',
        text: message,
      },
    ],
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${env.INFOBIP_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    logger.error(`[Infobip] SMS delivery failed to ${to}: ${res.status} ${errText}`)
    throw new Error(`Infobip SMS failed: ${res.status}`)
  }
}
