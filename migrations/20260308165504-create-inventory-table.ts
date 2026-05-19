// migrations/004-create-inventories.ts
import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('inventories', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      seller_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      is_available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      type: {
        type: DataTypes.ENUM('product', 'service'),
        allowNull: false,
        defaultValue: 'product',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    })

    // Add indexes
    await queryInterface.addIndex('inventories', ['seller_id'])
    await queryInterface.addIndex('inventories', ['is_available'])
    await queryInterface.addIndex('inventories', ['type'])
    await queryInterface.addIndex('inventories', ['seller_id', 'is_available'])
    await queryInterface.addIndex('inventories', ['created_at'])
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('inventories')
    // Drop enum type for Postgres
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_inventories_type";`)
  },
}
