// modules/inventory/inventory.routes.ts
import { Router } from 'express'
import { inventoryController } from '../inventory.controller'
import { authenticateToken } from '../../middleware/middleware'
import { validateBody } from '../../../helpers'
import { createInventorySchema, updateInventorySchema, addImagesSchema } from '../inventory.schema'

const router = Router()

// All inventory routes require authentication
router.use(authenticateToken)

// CRUD operations
router.post('/', validateBody(createInventorySchema), inventoryController.createInventoryItem)
router.get('/my-items', inventoryController.getMyInventory)
router.get('/search', inventoryController.searchMyInventory)
router.get('/seller/:seller_id', inventoryController.getInventoryBySeller)
router.get('/:inventory_id', inventoryController.getInventoryItemById)
router.patch('/:inventory_id', validateBody(updateInventorySchema), inventoryController.updateInventoryItem)
router.delete('/:inventory_id', inventoryController.deleteInventoryItem)

router.post('/:id/images', validateBody(addImagesSchema), inventoryController.addImages)
router.delete('/:id/images/:imageId', inventoryController.removeImage)

export const inventoryRouterV1 = router
