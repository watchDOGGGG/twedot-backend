import { Model, Table, Column, DataType, Default, CreatedAt } from 'sequelize-typescript'
import { OfflineMessage } from './messages.interface'

@Table({ tableName: 'offline_messages', modelName: 'offline_messages' })
class OfflineMessagesRepository extends Model<OfflineMessage> {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @Column({ type: DataType.UUID, allowNull: false })
  receiver_id!: string

  @Column({ type: DataType.UUID, allowNull: false })
  sender_id!: string

  @Column({ type: DataType.JSONB, allowNull: false })
  payload!: object

  @Column({ type: DataType.DATE, allowNull: false })
  expires_at!: Date

  @CreatedAt
  created_at!: Date
}

export default OfflineMessagesRepository
