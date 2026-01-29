import { localStore, LocalMessage } from './localStore';

/**
 * Manage offline message queue with retry logic
 */
export class OfflineQueue {
  private isProcessing = false;
  private retryDelay = 5000; // 5 seconds
  private maxRetries = 3;

  /**
   * Process all unsynced messages
   */
  async processQueue(
    sendToServer: (message: LocalMessage) => Promise<boolean>
  ): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ Queue already processing...');
      return;
    }

    this.isProcessing = true;
    console.log('🔄 Processing offline queue...');

    try {
      const unsynced = await localStore.getUnsyncedMessages();
      console.log(`📤 Found ${unsynced.length} unsynced messages`);

      for (const message of unsynced) {
        await this.retryMessage(message, sendToServer);
      }

      console.log('✅ Offline queue processing complete');
    } catch (error) {
      console.error('❌ Queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry sending a single message with exponential backoff
   */
  private async retryMessage(
    message: LocalMessage,
    sendToServer: (message: LocalMessage) => Promise<boolean>
  ): Promise<void> {
    let attempts = 0;
    let delay = this.retryDelay;

    while (attempts < this.maxRetries) {
      try {
        console.log(`🔄 Attempting to sync message ${message.id} (attempt ${attempts + 1})`);
        
        const success = await sendToServer(message);
        
        if (success) {
          await localStore.markAsSynced(message.id);
          console.log(`✅ Message ${message.id} synced successfully`);
          return;
        }
        
        attempts++;
        if (attempts < this.maxRetries) {
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      } catch (error) {
        console.error(`❌ Sync attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts < this.maxRetries) {
          await this.sleep(delay);
          delay *= 2;
        }
      }
    }

    console.warn(`⚠️ Message ${message.id} failed to sync after ${this.maxRetries} attempts`);
  }

  /**
   * Check if there are unsynced messages
   */
  async hasUnsynced(): Promise<boolean> {
    const unsynced = await localStore.getUnsyncedMessages();
    return unsynced.length > 0;
  }

  /**
   * Get count of unsynced messages
   */
  async getUnsyncedCount(): Promise<number> {
    const unsynced = await localStore.getUnsyncedMessages();
    return unsynced.length;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const offlineQueue = new OfflineQueue();
