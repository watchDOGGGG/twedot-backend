import { z } from 'zod'

export const createInventorySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0, 'Price cannot be negative').optional(),
  type: z.enum(['product', 'service']).optional(),
  is_available: z.boolean().optional().default(true),
  image_urls: z.array(z.string().url()).max(10).optional(),
})

export const updateInventorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  is_available: z.boolean().optional(),
  type: z.enum(['product', 'service']).optional(),
  image_urls: z.array(z.string().url()).max(10).optional(),
})

export const addImagesSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        publicId: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(10),
})
