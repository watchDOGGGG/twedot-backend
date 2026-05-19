import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  HasMany,
  Index,
} from 'sequelize-typescript'

import UserRepository from '../users/repositories/user.repository'
import InventoryImageRepository from './inventory-image.repository'

@Table({ tableName: 'inventories', modelName: 'inventories' })
class InventoryRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    allowNull: false,
  })
  id!: string

  @Index
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  seller_id!: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string

  @Column({
    type: DataType.TEXT,
  })
  description?: string

  @Default(0)
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  price!: number | null

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
  })
  is_available!: boolean

  @Default('product')
  @Column({
    type: DataType.ENUM('product', 'service'),
    allowNull: false,
  })
  type!: 'product' | 'service'

  @BelongsTo(() => UserRepository, 'seller_id')
  seller!: UserRepository

  @HasMany(() => InventoryImageRepository, {
    foreignKey: 'inventory_id',
  })
  images!: InventoryImageRepository[]

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default InventoryRepository
