import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('forward_records', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      // The original message ID that was tagged important (root of the chain)
      chain_root_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      original_sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Who forwarded this hop
      forwarder_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Who received this forwarded copy
      recipient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // The new message ID on the recipient's side (needed for delete-everywhere)
      hop_message_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    })

    await queryInterface.addIndex('forward_records', ['chain_root_id'])
    await queryInterface.addIndex('forward_records', ['original_sender_id'])
    await queryInterface.addIndex('forward_records', ['recipient_id'])
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('forward_records')
  },
}
