import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('important_messages', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      message_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      original_sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      original_recipient_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      forward_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    })

    await queryInterface.addIndex('important_messages', ['message_id'], { unique: true })
    await queryInterface.addIndex('important_messages', ['original_sender_id'])
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('important_messages')
  },
}
