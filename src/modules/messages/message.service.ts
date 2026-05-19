class MessageService {
  public async saveOfflineMessage() {} //→ store message for offline delivery

  public async getOfflineMessagesForUser() {} //→ fetch undelivered messages

  public async deleteOfflineMessage() {} //→ remove delivered or expired message

  public async deleteExpiredMessages() {} //→ clean up expired messages (optional cron job)
}
