export interface INVENTORY_MODEL {
  id: string
  seller_id: string
  title: string
  description: string | null
  price: number
  is_available: boolean
  type: 'product' | 'service' // NEW
  created_at: Date
  updated_at: Date
}

export interface INVENTORY_IMAGE_MODEL {
  id: string
  inventory_id: string
  image_url: string
  created_at: Date
}

export interface CreateInventoryPayload {
  seller_id: string
  title: string
  description?: string
  price?: number
  type?: 'product' | 'service' // NEW
  image_urls?: string[]
  is_available: boolean
}
export interface UpdateInventoryPayload {
  inventoryId: string
  seller_id: string
  title?: string
  description?: string
  price?: number
  is_available?: boolean
  type?: 'product' | 'service' // NEW
  image_urls?: string[]
}

export interface DeleteInventoryPayload {
  inventoryId: string
  seller_id: string
}

export interface GetInventoryByIdPayload {
  inventoryId: string
  seller_id?: string
}

export interface SearchMyInventoryPayload {
  seller_id: string
  query?: string
  min_price?: number
  max_price?: number
  is_available?: boolean
  page?: number
  limit?: number
}

export interface InventoryWithImages extends INVENTORY_MODEL {
  images: INVENTORY_IMAGE_MODEL[]
}
