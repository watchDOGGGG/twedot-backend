import { Model, Table, Column, DataType, Default, CreatedAt, BelongsTo, ForeignKey } from 'sequelize-typescript'

import InventoryRepository from './inventory.repository'

@Table({ tableName: 'inventory_images' })
class InventoryImageRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    allowNull: false,
  })
  id!: string

  @ForeignKey(() => InventoryRepository)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  inventory_id!: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  image_url!: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  thumbnail_url!: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  public_id!: string

  @BelongsTo(() => InventoryRepository)
  inventory!: InventoryRepository

  @CreatedAt
  created_at!: Date
}

export default InventoryImageRepository
