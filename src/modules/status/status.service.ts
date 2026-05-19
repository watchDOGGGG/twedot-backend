import { Op } from 'sequelize'
import StatusRepository from './status.repository'
import StatusViewRepository from './status-view.repository'
import UserRepository from '../users/repositories/user.repository'
import { logger } from '../../helpers/logger'

class StatusService {
  async createStatus(userId: string, payload: {
    type: 'text' | 'image' | 'video'
    content: string
    caption?: string
    thumbnailUrl?: string
    duration?: number
    isPrivate: boolean
  }) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const status = await StatusRepository.create({
      user_id: userId,
      type: payload.type,
      content: payload.content,
      caption: payload.caption || null,
      thumbnail_url: payload.thumbnailUrl || null,
      duration: payload.duration || null,
      is_private: payload.isPrivate,
      view_count: 0,
      expires_at: expiresAt,
    })
    return this.formatStatus(status, userId)
  }

  async getPrivateStatuses(userId: string) {
    // Return non-expired statuses from users who are contacts of the requesting user
    // For simplicity: return all non-expired private statuses excluding own
    const statuses = await StatusRepository.findAll({
      where: {
        is_private: true,
        user_id: { [Op.ne]: userId },
        expires_at: { [Op.gt]: new Date() },
      },
      include: [{ model: UserRepository, attributes: ['id', 'name', 'profile_photo_url'] }],
      order: [['created_at', 'DESC']],
    })

    const viewedIds = await StatusViewRepository.findAll({
      where: { viewer_id: userId },
      attributes: ['status_id'],
    }).then((rows) => new Set(rows.map((r) => r.status_id)))

    return statuses.map((s) => this.formatStatus(s, userId, viewedIds.has(s.id)))
  }

  async getPublicStatuses(userId: string) {
    const statuses = await StatusRepository.findAll({
      where: {
        is_private: false,
        user_id: { [Op.ne]: userId },
        expires_at: { [Op.gt]: new Date() },
      },
      include: [{ model: UserRepository, attributes: ['id', 'name', 'profile_photo_url'] }],
      order: [['created_at', 'DESC']],
    })

    const viewedIds = await StatusViewRepository.findAll({
      where: { viewer_id: userId },
      attributes: ['status_id'],
    }).then((rows) => new Set(rows.map((r) => r.status_id)))

    return statuses.map((s) => this.formatStatus(s, userId, viewedIds.has(s.id)))
  }

  async getMyStatuses(userId: string) {
    const statuses = await StatusRepository.findAll({
      where: {
        user_id: userId,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['created_at', 'DESC']],
    })
    return statuses.map((s) => this.formatStatus(s, userId))
  }

  async recordView(statusId: string, viewerId: string) {
    const status = await StatusRepository.findOne({
      where: { id: statusId, expires_at: { [Op.gt]: new Date() } },
    })

    if (!status) return null
    // Guard: owner cannot view their own status
    if (status.user_id === viewerId) return null

    // Insert or ignore duplicate
    const [, created] = await StatusViewRepository.findOrCreate({
      where: { status_id: statusId, viewer_id: viewerId },
      defaults: { status_id: statusId, viewer_id: viewerId },
    })

    if (created) {
      await StatusRepository.increment('view_count', {
        where: { id: statusId },
      })
      await status.reload()
    }

    return { viewCount: status.view_count }
  }

  async getViewers(statusId: string, requestingUserId: string) {
    const status = await StatusRepository.findByPk(statusId)
    if (!status || status.user_id !== requestingUserId) return []

    const views = await StatusViewRepository.findAll({
      where: { status_id: statusId },
      include: [{ model: UserRepository, attributes: ['id', 'name', 'profile_photo_url'] }],
      order: [['created_at', 'DESC']],
    })

    return views.map((v) => ({
      viewerId: v.viewer_id,
      viewerName: (v.viewer as any)?.name || 'Unknown',
      viewerPhoto: (v.viewer as any)?.profile_photo_url || null,
      viewedAt: v.createdAt,
    }))
  }

  async deleteStatus(statusId: string, userId: string) {
    const deleted = await StatusRepository.destroy({
      where: { id: statusId, user_id: userId },
    })
    return deleted > 0
  }

  async deleteExpiredStatuses() {
    const count = await StatusRepository.destroy({
      where: { expires_at: { [Op.lt]: new Date() } },
    })
    if (count > 0) logger.info(`Deleted ${count} expired statuses`)
    return count
  }

  private formatStatus(status: StatusRepository, requestingUserId: string, isViewed = false) {
    const user = (status as any).user
    return {
      id: status.id,
      userId: status.user_id,
      userName: user?.name || 'Unknown',
      userPhoto: user?.profile_photo_url || null,
      type: status.type,
      content: status.content,
      caption: status.caption,
      thumbnailUrl: status.thumbnail_url,
      duration: status.duration,
      createdAt: status.createdAt,
      expiresAt: status.expires_at,
      isPrivate: status.is_private,
      viewCount: status.view_count,
      isViewed,
    }
  }
}

export const statusService = new StatusService()