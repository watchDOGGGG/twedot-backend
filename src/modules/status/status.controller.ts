import { Request, Response } from 'express'
import { asyncHandler, buildResponse, throwError } from '../../helpers'
import { statusService } from './status.service'

interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

const { sendSuccessRes } = buildResponse

class StatusController {
  public createStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type, content, caption, thumbnailUrl, duration, isPrivate } = req.body
    if (!type || !content) return throwError(400, 'type and content are required')

    const status = await statusService.createStatus(req.user!.id, {
      type,
      content,
      caption,
      thumbnailUrl,
      duration,
      isPrivate: isPrivate !== false,
    })
    sendSuccessRes({ res, data: status, message: 'Status created', statusCode: 201 })
  })

  public getPrivateStatuses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statuses = await statusService.getPrivateStatuses(req.user!.id)
    sendSuccessRes({ res, data: statuses, message: 'Private statuses fetched' })
  })

  public getPublicStatuses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statuses = await statusService.getPublicStatuses(req.user!.id)
    sendSuccessRes({ res, data: statuses, message: 'Public statuses fetched' })
  })

  public getMyStatuses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statuses = await statusService.getMyStatuses(req.user!.id)
    sendSuccessRes({ res, data: statuses, message: 'My statuses fetched' })
  })

  public markAsViewed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { statusId } = req.params
    const result = await statusService.recordView(statusId, req.user!.id)
    sendSuccessRes({ res, data: result, message: 'Status marked as viewed' })
  })

  public getViewers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { statusId } = req.params
    const viewers = await statusService.getViewers(statusId, req.user!.id)
    sendSuccessRes({ res, data: viewers, message: 'Viewers fetched' })
  })

  public deleteStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { statusId } = req.params
    const deleted = await statusService.deleteStatus(statusId, req.user!.id)
    if (!deleted) return throwError(404, 'Status not found or not yours')
    sendSuccessRes({ res, data: null, message: 'Status deleted' })
  })
}

export const statusController = new StatusController()