import {
  Model,
  Table,
  Column,
  DataType,
  Default,
  CreatedAt,
  UpdatedAt,
  Index,
  AllowNull,
} from 'sequelize-typescript'

@Table({ tableName: 'feedbacks', modelName: 'feedbacks' })
class FeedbackRepository extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false })
  id!: string

  @Index
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string

  @Column({ type: DataType.STRING, allowNull: false })
  issue_type!: string

  @Column({ type: DataType.TEXT, allowNull: false })
  description!: string

  @AllowNull
  @Column({ type: DataType.STRING })
  image_url!: string | null

  @CreatedAt
  created_at!: Date

  @UpdatedAt
  updated_at!: Date
}

export default FeedbackRepository
