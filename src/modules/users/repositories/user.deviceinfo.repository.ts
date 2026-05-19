// modules/users/repositories/user.device.repository.ts
import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  ForeignKey,
  AllowNull,
} from 'sequelize-typescript'
import { DeviceInfo } from '../user.interface'
import UserRepository from './user.repository'

@Table({
  tableName: 'devices',
  modelName: 'devices',
  timestamps: true,
})
class DeviceRepository extends Model<DeviceInfo> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string

  @Column({ type: DataType.STRING, allowNull: false })
  device_id!: string

  @AllowNull
  @Column({ type: DataType.TEXT })
  fcm_token!: string | null

  @BelongsTo(() => UserRepository, 'user_id')
  user!: UserRepository

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default DeviceRepository
