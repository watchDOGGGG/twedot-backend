// server.ts (update)
import app from './app'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.config'
import sequelize from './config/db-config/sequelize.instance'
import { logger } from './helpers/logger'
import { redisClient } from './config/redis'
import { startSocket } from './modules/socket'
import { setIo } from './config/socket.singleton'
import { startMediaWorker } from './modules/media/media.worker'

dotenv.config()
const PORT = parseInt(env.PORT || '2026', 10)

const httpServer = createServer(app)

const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim())
  : '*'

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins },
})

const STATUS_EXPIRY_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

sequelize
  .authenticate()
  .then(async () => {
    if (env.ENVIRONMENT !== 'production') {
      await sequelize.sync({ alter: true })
    }
    logger.info('Database synced')
    httpServer.listen(PORT, () => {
      redisClient.on('error', (err) => logger.error('Redis Error:', err))
      ;(async () => {
        await redisClient.connect()
        logger.info('Connected to Redis')
        setIo(io)
        startSocket(io)
        logger.info('Socket.io started')
        startMediaWorker()

        // Run once at startup, then on interval — deletes expired statuses regardless of user online state
        const { statusService } = await import('./modules/status/status.service')
        await statusService.deleteExpiredStatuses()
        setInterval(() => {
          statusService.deleteExpiredStatuses().catch((err) =>
            logger.error('Status expiry job failed:', err),
          )
        }, STATUS_EXPIRY_INTERVAL_MS)
        logger.info('Status expiry job scheduled every 30 minutes')
      })()
      logger.info(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    logger.error('Database connection failed:', error)
  })
