import express, { Application, Request, Response, NextFunction } from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './helpers/error-handler'
import { env } from './config/env.config'
import { version } from '../package.json'
import { userRouterV1 } from './modules/users/routes/v1'
import { inventoryRouterV1 } from './modules/inventory/routes/v1'
import { mediaRouterV1 } from './modules/media/routes/v1'
import { statusRouterV1 } from './modules/status/routes/v1'
import { feedbackRouterV1 } from './modules/feedback/routes/v1'
import { systemRouterV1 } from './modules/system/routes/v1'
import { messagesRouterV1 } from './modules/messages/routes/v1'
import { forwardRouterV1 } from './modules/messages/forward/forward.routes'
import { adminRouterV1 } from './modules/admin/admin.routes'

const app: Application = express()

app.set('trust proxy', 1)

// Security headers — must be before any route
app.use(helmet())

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests, please try again later.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many auth requests, please try again later.' },
})

// Search is a geo DB query — expensive; cap tightly
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many search requests, please slow down.' },
})

// Media uploads consume bandwidth + Cloudinary processing
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Upload limit reached, please try again later.' },
})

app.use(globalLimiter)

// CORS — restrict to allowed origins; defaults to open for dev
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null

app.use(
  cors({
    origin: allowedOrigins ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
)

app.use(morgan(env.ENVIRONMENT === 'production' ? 'tiny' : 'dev'))

app.use('/static', express.static(path.join(__dirname, 'public')))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

app.get('/', (_req, res: Response) => {
  res.status(200).json({
    message: 'Welcome to souk service',
    data: {
      environment: env.ENVIRONMENT,
      version,
    },
  })
})

// route registration — specific limiters apply before the router
app.use('/api/v1/users/auth', authLimiter)
app.use('/api/v1/users/search', searchLimiter)
app.use('/api/v1/media', uploadLimiter)
app.use('/api/v1/users', userRouterV1)
app.use('/api/v1/inventory', inventoryRouterV1)
app.use('/api/v1/media', mediaRouterV1)
app.use('/api/v1/status', statusRouterV1)
app.use('/api/v1/feedback', feedbackRouterV1)
app.use('/api/v1/system', systemRouterV1)
app.use('/api/v1/messages', messagesRouterV1)
app.use('/api/v1/messages', forwardRouterV1)
app.use('/api/v1/admin', adminRouterV1)

// rabbit mq consumers
app.use(errorHandler)

app.use((_req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next()
  }
  res.status(404).json({
    message: 'Route not found',
    error: { message: 'Route not found' },
    data: undefined,
    success: false,
  })
})

export default app
