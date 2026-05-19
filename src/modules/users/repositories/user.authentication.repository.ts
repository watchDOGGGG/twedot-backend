// modules/users/repositories/user.auth.repository.ts
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
} from 'sequelize-typescript'
import { AuthenticationToken } from '../user.interface'
import UserRepository from './user.repository'

@Table({
  tableName: 'auth_tokens',
  modelName: 'auth_tokens',
  timestamps: true,
})
class AuthRepository extends Model<AuthenticationToken> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @ForeignKey(() => UserRepository)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  token!: string

  @Column({ type: DataType.DATE, allowNull: false })
  expires!: Date

  @BelongsTo(() => UserRepository, 'user_id')
  user!: UserRepository

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default AuthRepository
