import { Sequelize } from 'sequelize-typescript'

import { env } from '../env.config'
import UserRepository from '../../modules/users/repositories/user.repository'
import InventoryRepository from '../../modules/inventory/inventory.repository'
import DeviceRepository from '../../modules/users/repositories/user.deviceinfo.repository'
import AuthenticationRepository from '../../modules/users/repositories/user.authentication.repository'
import InventoryImageRepository from '../../modules/inventory/inventory-image.repository'
import StatusRepository from '../../modules/status/status.repository'
import StatusViewRepository from '../../modules/status/status-view.repository'
import BlockedUsersRepository from '../../modules/users/repositories/user.blockedusers.repository'
import FeedbackRepository from '../../modules/feedback/feedback.repository'

const dialectMapping: Record<string, 'mysql' | 'postgres' | 'sqlite'> = {
  postgres: 'postgres',
}

const dialectOptions = () => {
  if (['staging', 'production'].includes(env.ENVIRONMENT)) {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  }
  return {}
}

const sequelize = new Sequelize({
  database: env.DATABASE_NAME,
  dialect: dialectMapping[env.DATABASE_DIALECT],
  host: env.DATABASE_HOST,
  port: parseInt(env.DATABASE_PORT),
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  storage: ':memory:',
  models: [UserRepository, InventoryRepository, InventoryImageRepository, DeviceRepository, AuthenticationRepository, StatusRepository, StatusViewRepository, BlockedUsersRepository, FeedbackRepository],
  define: {
    timestamps: true, // Enable timestamps (createdAt and updatedAt)
    underscored: true, // Use snake_case for table and column names
  },
  logging: env.ENVIRONMENT === 'development' ? console.log : false,
  dialectOptions: {
    ...dialectOptions(),
  },
})

export default sequelize
