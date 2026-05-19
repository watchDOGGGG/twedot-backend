import { asyncHandler, buildResponse } from '../../helpers'
import { Request } from 'express'
import { CreateInventoryPayload, UpdateInventoryPayload } from './inventory.interface'
import { inventoryService } from './inventory.service'

const { sendSuccessRes } = buildResponse

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    phone_number?: string
  }
}

class InventoryController {
  private inventoryS = inventoryService

  public createInventoryItem = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload: CreateInventoryPayload = {
      ...req.body,
      seller_id: req.user!.id,
    }

    const response = await this.inventoryS.createInventoryItem(payload)

    sendSuccessRes({
      data: response,
      statusCode: 201,
      message: response.message,
      res,
    })
  })

  public updateInventoryItem = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { inventory_id } = req.params

    const payload: UpdateInventoryPayload = {
      ...req.body,
      inventoryId: inventory_id,
      seller_id: req.user!.id,
    }

    const response = await this.inventoryS.updateInventoryItem(payload)

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: response.message,
      res,
    })
  })

  public deleteInventoryItem = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { inventory_id } = req.params

    const response = await this.inventoryS.deleteInventoryItem({
      inventoryId: inventory_id,
      seller_id: req.user!.id,
    })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: response.message,
      res,
    })
  })

  public getMyInventory = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = parseInt(req.query.page as string) || undefined
    const limit = parseInt(req.query.limit as string) || undefined
    const is_available = req.query.is_available !== undefined ? req.query.is_available === 'true' : undefined

    const response = await this.inventoryS.getInventoryBySeller(req.user!.id, {
      page,
      limit,
      is_available,
    })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Inventory fetched successfully',
      res,
    })
  })

  public getInventoryBySeller = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { seller_id } = req.params
    const page = parseInt(req.query.page as string) || undefined
    const limit = parseInt(req.query.limit as string) || undefined
    const is_available = req.query.is_available !== undefined ? req.query.is_available === 'true' : undefined

    const response = await this.inventoryS.getInventoryBySeller(seller_id, {
      page,
      limit,
      is_available,
    })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Inventory fetched successfully',
      res,
    })
  })

  public getInventoryItemById = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { inventory_id } = req.params

    const response = await this.inventoryS.getInventoryItemById({
      inventoryId: inventory_id,
    })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Inventory item fetched successfully',
      res,
    })
  })

  public searchMyInventory = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const response = await this.inventoryS.searchMyInventory({
      seller_id: req.user!.id,
      query: req.query.query as string,
      min_price: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
      max_price: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
      is_available: req.query.is_available !== undefined ? req.query.is_available === 'true' : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    })

    sendSuccessRes({
      data: response,
      statusCode: 200,
      message: 'Inventory search completed successfully',
      res,
    })
  })

  public addImages = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params
    const { images } = req.body // Array of { url, thumbnailUrl, publicId }

    const result = await inventoryService.addImages(id, req.user!.id, images)

    sendSuccessRes({
      data: result,
      statusCode: 200,
      message: 'Images added successfully',
      res,
    })
  })

  public removeImage = asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, imageId } = req.params

    const result = await inventoryService.removeImage(id, imageId, req.user!.id)

    sendSuccessRes({
      data: result,
      statusCode: 200,
      message: 'Image removed successfully',
      res,
    })
  })
}

export const inventoryController = new InventoryController()
