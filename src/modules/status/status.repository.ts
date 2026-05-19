import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  AllowNull,
  BelongsTo,
  HasMany,
  ForeignKey,
} from 'sequelize-typescript'
import UserRepository from '../users/repositories/user.repository'
import StatusViewRepository from './status-view.repository'

@Table({
  tableName: 'statuses',
  modelName: 'statuses',
  timestamps: true,
})
class StatusRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string

  @Column({ type: DataType.ENUM('text', 'image', 'video'), allowNull: false })
  type!: 'text' | 'image' | 'video'

  @Column({ type: DataType.TEXT, allowNull: false })
  content!: string

  @AllowNull
  @Column({ type: DataType.TEXT })
  caption!: string | null

  @AllowNull
  @Column({ type: DataType.STRING })
  thumbnail_url!: string | null

  @AllowNull
  @Column({ type: DataType.INTEGER })
  duration!: number | null

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  is_private!: boolean

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  view_count!: number

  @Column({ type: DataType.DATE, allowNull: false })
  expires_at!: Date

  @BelongsTo(() => UserRepository)
  user!: UserRepository

  @HasMany(() => StatusViewRepository)
  views!: StatusViewRepository[]
}

export default StatusRepository