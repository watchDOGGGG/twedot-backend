export interface OfflineMessage {
  id: string
  receiver_id: string
  sender_id: string
  payload: object
  created_at?: Date
  expires_at: Date
}
