import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('devices', 'fcm_token', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    })
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('devices', 'fcm_token')
  },
}
