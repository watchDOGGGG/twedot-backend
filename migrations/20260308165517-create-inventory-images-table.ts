// migrations/005-create-inventory-images.ts
import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('inventory_images', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      inventory_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'inventories',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      thumbnail_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      public_id: {
        type: DataTypes.STRING,
        allowNull: true,
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
    await queryInterface.addIndex('inventory_images', ['inventory_id'])
    await queryInterface.addIndex('inventory_images', ['public_id'])
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('inventory_images')
  },
}
