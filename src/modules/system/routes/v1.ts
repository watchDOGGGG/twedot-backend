import { Router, Request, Response } from 'express'

const router = Router()

// Update this whenever a new version is released to stores
const LATEST_VERSION = {
  version: '1.0.0',
  force_update: false,
  store_urls: {
    ios: 'https://apps.apple.com/app/twedot',
    android: 'https://play.google.com/store/apps/details?id=com.twedot.app',
  },
}

router.get('/version', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Version info',
    data: LATEST_VERSION,
  })
})

export const systemRouterV1 = router
