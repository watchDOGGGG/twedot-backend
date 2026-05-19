// modules/users/user.routes.ts
import { Router } from 'express'
import { userController } from '../user.controller'
import { authenticateToken } from '../../middleware/middleware'

const router = Router()

// Public routes (no auth required)
router.post('/auth/register', userController.registerUser)
router.post('/auth/resend-otp', userController.resendOtp)
router.post('/auth/verify-otp', userController.verifyOtp)
router.post('/auth/refresh-token', userController.refreshToken)

// Protected routes (auth required)
router.use(authenticateToken)

router.get('/me', userController.getCurrentUser)
router.patch('/me', userController.updateProfile)
router.post('/request-account-info', userController.requestAccountInfo)
router.get('/blocked', userController.getBlockedUsers)
router.post('/block/:user_id', userController.blockUser)
router.delete('/block/:user_id', userController.unblockUser)
router.get('/getby_id/:user_id', userController.getUserById)
router.get('/phone/:phone_number', userController.getUserByPhoneNumber)
router.patch('/complete-profile', userController.completeProfile)
router.get('/search', userController.searchUsers)
router.post('/verify-contacts', userController.verifyUserContacts)

router.post('/auth/logout', userController.logout)
router.post('/auth/logout-all', userController.logoutAllDevices)
router.delete('/me', userController.deleteAccount)

// E2E encryption key exchange
router.patch('/me/public-key', userController.savePublicKey)
router.get('/:user_id/public-key', userController.getPublicKey)

// Push notification token management
router.post('/fcm-token', userController.saveFcmToken)
router.delete('/fcm-token', userController.deleteFcmToken)

// User reports
router.post('/report', userController.reportUser)

export const userRouterV1 = router
