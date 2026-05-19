// backend/src/config/firebase.config.ts
// Initializes Firebase Admin SDK using env vars.
// All FCM calls are no-ops until FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY are set.
import { logger } from '../helpers/logger'

let firebaseAdmin: typeof import('firebase-admin') | null = null
let firebaseApp: any = null
let initialized = false

export async function getFirebaseAdmin() {
  if (initialized) return firebaseApp

  initialized = true

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase Admin SDK not configured — push notifications disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable.')
    return null
  }

  try {
    firebaseAdmin = await import('firebase-admin')
    if (!firebaseAdmin!.apps.length) {
      firebaseApp = firebaseAdmin!.initializeApp({
        credential: firebaseAdmin!.credential.cert({
          projectId,
          clientEmail,
          // .env stores \n as literal \\n
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      })
    } else {
      firebaseApp = firebaseAdmin!.apps[0]
    }
    logger.info('Firebase Admin SDK initialized')
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin SDK:', err as any)
    firebaseApp = null
  }

  return firebaseApp
}
