import { Op, WhereOptions } from 'sequelize'
import { throwError } from '../../helpers'
import InventoryRepository from './inventory.repository'
import InventoryImageRepository from './inventory-image.repository'
import UserRepository from '../users/repositories/user.repository'
import {
  CreateInventoryPayload,
  UpdateInventoryPayload,
  DeleteInventoryPayload,
  GetInventoryByIdPayload,
  SearchMyInventoryPayload,
  InventoryWithImages,
} from './inventory.interface'
import { mediaService } from '../media/media.service'

class InventoryService {
  private readonly DEFAULT_PAGE = 1
  private readonly DEFAULT_LIMIT = 20
  private readonly MAX_LIMIT = 100

  public async createInventoryItem(payload: CreateInventoryPayload) {
    const { seller_id, title, description, price, image_urls, type, is_available } = payload

    // Validate seller exists and is verified
    const seller = await UserRepository.findByPk(seller_id)
    if (!seller) {
      return throwError(404, { message: 'Seller not found' })
    }

    if (!seller.is_verified) {
      return throwError(403, { message: 'Seller account not verified' })
    }

    // Validate price only if provided (optional now)
    if (price !== undefined && price !== null && price <= 0) {
      return throwError(400, { message: 'Price must be greater than 0' })
    }

    // Validate title
    if (!title.trim()) {
      return throwError(400, { message: 'Title is required' })
    }

    // Create inventory item - price can be null/undefined
    const inventory = await InventoryRepository.create({
      seller_id,
      title: title.trim(),
      description: description?.trim() || null,
      price: price || 0, // Store null if not provided
      type: type || 'product',
      is_available: is_available ?? true,
    } as any)

    // Create images if provided
    if (image_urls && image_urls.length > 0) {
      const validUrls = image_urls
        .filter((url) => url.trim())
        .map((url) => ({
          inventory_id: inventory.id,
          image_url: url.trim(),
        }))

      if (validUrls.length > 0) {
        await InventoryImageRepository.bulkCreate(validUrls as any)
      }
    }

    // Fetch complete item with images
    const completeItem = await this.getInventoryWithImages(inventory.id)

    return {
      item: completeItem,
      message: 'Inventory item created successfully',
    }
  }

  public async updateInventoryItem(payload: UpdateInventoryPayload) {
    const { inventoryId, seller_id, image_urls, type, ...updates } = payload

    const inventory = await InventoryRepository.findOne({
      where: { id: inventoryId, seller_id },
      include: ['images'],
    })

    if (!inventory) {
      return throwError(404, { message: 'Inventory item not found or access denied' })
    }

    let hasChanges = false

    // Update basic fields
    const allowedFields = ['title', 'description', 'price', 'is_available', 'type']
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue
      if (!allowedFields.includes(key)) continue

      const currentValue = (inventory as any)[key]

      // Handle null/undefined price
      if (key === 'price') {
        if (value === null || value === undefined) {
          if (currentValue !== null) {
            ;(inventory as any)[key] = null
            hasChanges = true
          }
          continue
        }
        if (updates.price !== undefined) {
          const priceNum = typeof updates.price === 'string' ? parseFloat(updates.price) : updates.price

          if (typeof priceNum !== 'number' || isNaN(priceNum) || priceNum <= 0) {
            return throwError(400, { message: 'Price must be a valid number greater than 0' })
          }
        }
        if (value === currentValue) continue
        ;(inventory as any)[key] = value
        hasChanges = true
        continue
      }

      // Skip if same value (handle string trim for title/description)
      if (key === 'title' || key === 'description') {
        const newValue = typeof value === 'string' ? value.trim() : value
        if (newValue === currentValue) continue
        ;(inventory as any)[key] = newValue || null
      } else {
        if (value === currentValue) continue
        ;(inventory as any)[key] = value
      }

      hasChanges = true
    }

    // Validate price if updated
    if (updates.price !== undefined && updates.price <= 0) {
      return throwError(400, { message: 'Price must be greater than 0' })
    }

    // Handle image updates
    if (image_urls !== undefined) {
      // Delete existing images
      await InventoryImageRepository.destroy({
        where: { inventory_id: inventoryId },
      })

      // Create new images
      const validUrls = image_urls
        .filter((url) => url.trim())
        .map((url) => ({
          inventory_id: inventoryId,
          image_url: url.trim(),
        }))

      if (validUrls.length > 0) {
        await InventoryImageRepository.bulkCreate(validUrls as any)
      }
      hasChanges = true
    }

    if (hasChanges) {
      await inventory.save()
    }

    const updatedItem = await this.getInventoryWithImages(inventoryId)

    return {
      item: updatedItem,
      updated: hasChanges,
      message: hasChanges ? 'Inventory item updated successfully' : 'No changes made',
    }
  }

  public async deleteInventoryItem(payload: DeleteInventoryPayload) {
    const { inventoryId, seller_id } = payload

    const inventory = await InventoryRepository.findOne({
      where: { id: inventoryId, seller_id },
    })

    if (!inventory) {
      return throwError(404, { message: 'Inventory item not found or access denied' })
    }

    // Delete associated images first (cascade)
    await InventoryImageRepository.destroy({
      where: { inventory_id: inventoryId },
    })

    await inventory.destroy()

    return {
      message: 'Inventory item deleted successfully',
      deletedId: inventoryId,
    }
  }

  public async getInventoryBySeller(
    sellerId: string,
    options?: {
      page?: number
      limit?: number
      is_available?: boolean
    },
  ) {
    const page = options?.page || this.DEFAULT_PAGE
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT)
    const offset = (page - 1) * limit

    const where: WhereOptions = { seller_id: sellerId }
    if (options?.is_available !== undefined) {
      where.is_available = options.is_available
    }

    const { count, rows } = await InventoryRepository.findAndCountAll({
      where,
      include: ['images'],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    })

    return {
      items: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    }
  }

  public async getInventoryItemById(payload: GetInventoryByIdPayload) {
    const { inventoryId, seller_id } = payload

    const where: any = { id: inventoryId }
    if (seller_id) {
      where.seller_id = seller_id
    }

    const item = await InventoryRepository.findOne({
      where,
      include: ['images'],
    })

    if (!item) {
      return throwError(404, { message: 'Inventory item not found' })
    }

    return { item }
  }

  public async searchMyInventory(payload: SearchMyInventoryPayload) {
    const {
      seller_id,
      query,
      min_price,
      max_price,
      is_available,
      page = this.DEFAULT_PAGE,
      limit = this.DEFAULT_LIMIT,
    } = payload

    const normalizedLimit = Math.min(limit, this.MAX_LIMIT)
    const offset = (page - 1) * normalizedLimit

    // Build where clause - always filter by seller
    const where: WhereOptions = { seller_id }

    if (is_available !== undefined) {
      where.is_available = is_available
    }

    if (min_price !== undefined || max_price !== undefined) {
      where.price = {}
      if (min_price !== undefined) {
        ;(where.price as any)[Op.gte] = min_price
      }
      if (max_price !== undefined) {
        ;(where.price as any)[Op.lte] = max_price
      }
    }

    // Text search on title only (seller searching their own items)
    if (query?.trim()) {
      where.title = { [Op.iLike]: `%${query.trim()}%` }
    }

    const { count, rows } = await InventoryRepository.findAndCountAll({
      where,
      include: ['images'],
      order: [['created_at', 'DESC']],
      limit: normalizedLimit,
      offset,
    })

    return {
      items: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / normalizedLimit),
    }
  }

  // Helper method to get inventory with images
  private async getInventoryWithImages(inventoryId: string): Promise<InventoryWithImages | null> {
    const item = await InventoryRepository.findByPk(inventoryId, {
      include: ['images'],
    })

    return item as InventoryWithImages | null
  }

  public async addImages(inventoryId: string, userId: string, images: any[]) {
    const item = await InventoryRepository.findByPk(inventoryId)

    if (!item) {
      return throwError(404, { message: 'Item not found' })
    }

    if (item.seller_id !== userId) {
      return throwError(403, { message: 'Not authorized' })
    }

    const imageRecords = images.map((img) => ({
      inventory_id: inventoryId,
      image_url: img.url,
      thumbnail_url: img.thumbnailUrl,
      public_id: img.publicId,
    }))

    await InventoryImageRepository.bulkCreate(imageRecords)

    // Use existing method
    return await this.getInventoryWithImages(inventoryId)
  }

  public async removeImage(inventoryId: string, imageId: string, userId: string) {
    const item = await InventoryRepository.findByPk(inventoryId)

    if (!item) {
      return throwError(404, { message: 'Item not found' })
    }

    if (item.seller_id !== userId) {
      return throwError(403, { message: 'Not authorized' })
    }

    const image = await InventoryImageRepository.findByPk(imageId)

    if (!image || image.inventory_id !== inventoryId) {
      return throwError(404, { message: 'Image not found' })
    }

    // Delete from Cloudinary if public_id exists
    if (image.public_id) {
      await mediaService.deleteFromCloudinary(image.public_id)
    }

    await image.destroy()

    return { success: true }
  }
}

export const inventoryService = new InventoryService()
