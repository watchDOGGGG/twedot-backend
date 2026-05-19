// migrations/20260105082438-create-users-table.ts
import { QueryInterface, DataTypes } from 'sequelize'

export default {
  up: async (queryInterface: QueryInterface) => {
    // Enable PostGIS first
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;')

    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      country_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      occupation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_photo_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DOUBLE,
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

    // Add geospatial index
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_users_location 
      ON users 
      USING gist (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `)
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('users')
  },
}
