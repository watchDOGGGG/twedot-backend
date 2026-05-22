import { Router, Request, Response, NextFunction } from 'express'
import { Op, fn, col, literal } from 'sequelize'
import sequelize from '../../config/db-config/sequelize.instance'
import UserRepository from '../users/repositories/user.repository'

const router = Router()

// Simple admin key guard — set ADMIN_KEY in .env
const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-admin-key']
  const expected = process.env.ADMIN_KEY
  if (!expected || key !== expected) {
    res.status(401).json({ success: false, message: 'Unauthorised' })
    return
  }
  next()
}

router.use(adminGuard)

// GET /admin/stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())

    const [total, verified, today, this_week, recent] = await Promise.all([
      UserRepository.count(),
      UserRepository.count({ where: { is_verified: true } }),
      UserRepository.count({ where: { created_at: { [Op.gte]: startOfToday } } }),
      UserRepository.count({ where: { created_at: { [Op.gte]: startOfWeek } } }),
      UserRepository.findAll({
        order: [['created_at', 'DESC']],
        limit: 10,
        attributes: ['id', 'name', 'phone_number', 'occupation', 'profile_photo_url', 'is_verified', 'created_at', 'city', 'country'],
      }),
    ])

    res.json({ success: true, message: 'Stats', data: { total, verified, today, this_week, recent } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /admin/users?page=1&limit=20&search=
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const search = ((req.query.search as string) ?? '').trim()
    const offset = (page - 1) * limit

    const whereClause = search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { phone_number: { [Op.iLike]: `%${search}%` } },
            { occupation: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}

    const { count, rows } = await UserRepository.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'name', 'phone_number', 'occupation', 'profile_photo_url', 'is_verified', 'created_at', 'city', 'country', 'country_code', 'website'],
    })

    res.json({
      success: true,
      message: 'Users',
      data: { users: rows, total: count, page, limit },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /admin/growth?days=30  — daily registrations for the past N days
router.get('/growth', async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30))

    const rows = await sequelize.query(
      `SELECT DATE(created_at) AS day, COUNT(*)::int AS count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY day
       ORDER BY day ASC`,
      { type: 'SELECT' }
    ) as Array<{ day: string; count: number }>

    // Fill in zero-count days so the chart is continuous
    const result: Array<{ day: string; count: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const found = rows.find(r => r.day.startsWith(key))
      result.push({ day: key, count: found ? Number(found.count) : 0 })
    }

    res.json({ success: true, message: 'Growth data', data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export const adminRouterV1 = router
