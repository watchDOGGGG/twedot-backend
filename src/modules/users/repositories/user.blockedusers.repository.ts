import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript'
import UserRepository from './user.repository'

@Table({
  tableName: 'blocked_users',
  modelName: 'blocked_users',
  timestamps: true,
  indexes: [
    { fields: ['blocker_id', 'blocked_id'], unique: true },
  ],
})
class BlockedUsersRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  blocker_id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  blocked_id!: string

  @BelongsTo(() => UserRepository, 'blocked_id')
  blockedUser!: UserRepository

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default BlockedUsersRepository
