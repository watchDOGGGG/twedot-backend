// modules/users/repositories/user.repository.ts
import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  AllowNull,
  HasOne,
} from 'sequelize-typescript'
import { USER_MODEL } from '../user.interface'
import InventoryRepository from '../../inventory/inventory.repository'

@Table({
  tableName: 'users',
  modelName: 'users',
  timestamps: true,
})
class UserRepository extends Model<USER_MODEL> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  phone_number!: string

  @AllowNull
  @Column({ type: DataType.STRING })
  name!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  occupation!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  country_code!: string | null

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  is_verified!: boolean

  @AllowNull
  @Column({ type: DataType.STRING })
  profile_photo_url!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  country!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  city!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  website!: string | null

  @AllowNull
  @Column({ type: DataType.DOUBLE })
  latitude!: number | null

  @AllowNull
  @Column({ type: DataType.DOUBLE })
  longitude!: number | null

  @AllowNull
  @Column({ type: DataType.TEXT })
  public_key!: string | null

  @HasOne(() => InventoryRepository, 'seller_id')
  inventories!: InventoryRepository

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default UserRepository
