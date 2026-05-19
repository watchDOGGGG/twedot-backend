import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  BelongsTo,
  ForeignKey,
  CreatedAt,
  Unique,
  Index,
} from 'sequelize-typescript'
import UserRepository from '../users/repositories/user.repository'
import StatusRepository from './status.repository'

@Table({
  tableName: 'status_views',
  modelName: 'status_views',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['status_id', 'viewer_id'],
    },
  ],
})
class StatusViewRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @ForeignKey(() => StatusRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  status_id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  viewer_id!: string

  @BelongsTo(() => StatusRepository)
  status!: StatusRepository

  @BelongsTo(() => UserRepository)
  viewer!: UserRepository
}

export default StatusViewRepository