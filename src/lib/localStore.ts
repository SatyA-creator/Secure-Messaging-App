import Dexie, { Table } from 'dexie';

// Database schema interfaces
export interface LocalMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  timestamp: string;
  content: string;
  signature?: string;
  
  // Cryptographic metadata for algorithm agility
  cryptoVersion?: string;
  encryptionAlgorithm?: string;
  kdfAlgorithm?: string;
  signatures?: Array<{
    algorithm: string;
    signature: string;
    key_id?: string;
    timestamp?: string;
  }>;
  
  // Media attachments
  hasMedia?: boolean;
  mediaAttachments?: Array<{
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    file_url: string;
    category: string;
    thumbnail_url?: string;
  }>;
  mediaUrls?: string[];
  
  synced: boolean;
  createdAt: Date;
}

export interface ConversationMeta {
  id: string;
  participants: string[];
  // Multi-key storage per user: userId -> array of key versions
  publicKeys: Record<string, Array<{
    keyId: string;
    algorithm: string;
    keyData: string;
    createdAt: string;
    status?: string;
  }>>;
  lastMessage?: Date;
  settings?: Record<string, unknown>;
}

// Dexie database class
class LocalMessagingDB extends Dexie {
  messages!: Table<LocalMessage>;
  conversations!: Table<ConversationMeta>;

  constructor() {
    super('QuChatDB');
    
    // Define schema
    this.version(1).stores({
      messages: 'id, conversationId, from, to, timestamp, synced, cryptoVersion',
      conversations: 'id, *participants, lastMessage'
    });
  }
}

// Singleton instance
const db = new LocalMessagingDB();

// API functions
export class LocalStore {
  
  /**
   * Save a message to local storage
   */
  async saveMessage(message: Omit<LocalMessage, 'createdAt'>): Promise<LocalMessage> {
    const msg: LocalMessage = {
      ...message,
      createdAt: new Date()
    };
    
    // ✅ Check if message already exists to avoid duplicates
    const existing = await db.messages.get(msg.id);
    if (existing) {
      console.log('⚠️ Message already exists in local storage, updating:', msg.id);
      await db.messages.update(msg.id, {
        content: msg.content,
        synced: msg.synced,
        hasMedia: msg.hasMedia,
        mediaAttachments: msg.mediaAttachments,
        mediaUrls: msg.mediaUrls
      });
      return msg;
    }
    
    await db.messages.add(msg);
    
    // Update conversation metadata
    await this.updateConversationMeta(message.conversationId, {
      lastMessage: new Date()
    });
    
    console.log('💾 Message saved locally:', msg.id);
    return msg;
  }

  /**
   * Get all messages for a conversation
   */
  async getConversation(conversationId: string): Promise<LocalMessage[]> {
    const messages = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp');
    
    console.log(`📥 Loaded ${messages.length} messages from local storage`);
    return messages;
  }

  /**
   * Get all conversations
   */
  async getAllConversations(): Promise<ConversationMeta[]> {
    return await db.conversations.toArray();
  }

  /**
   * Mark message as synced with server
   */
  async markAsSynced(messageId: string): Promise<void> {
    await db.messages.update(messageId, { synced: true });
    console.log('✅ Message marked as synced:', messageId);
  }

  /**
   * Get unsynced messages (for retry/sync)
   */
  async getUnsyncedMessages(): Promise<LocalMessage[]> {
    return await db.messages
      .where('synced')
      .equals(0)
      .toArray();
  }

  /**
   * Create or update conversation metadata
   */
  async updateConversationMeta(
    conversationId: string, 
    updates: Partial<ConversationMeta>
  ): Promise<void> {
    const existing = await db.conversations.get(conversationId);
    
    if (existing) {
      await db.conversations.update(conversationId, updates);
    } else {
      await db.conversations.add({
        id: conversationId,
        participants: [],
        publicKeys: {},
        ...updates
      });
    }
  }

  /**
   * Delete conversation and all its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await db.messages.where('conversationId').equals(conversationId).delete();
    await db.conversations.delete(conversationId);
    console.log('🗑️ Conversation deleted locally:', conversationId);
  }

  /**
   * Clear all local data (for testing/logout)
   */
  async clearAllData(): Promise<void> {
    await db.messages.clear();
    await db.conversations.clear();
    console.log('🧹 All local data cleared');
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const messageCount = await db.messages.count();
    const conversationCount = await db.conversations.count();
    const unsyncedCount = await db.messages.where('synced').equals(0).count();
    
    return {
      totalMessages: messageCount,
      totalConversations: conversationCount,
      unsyncedMessages: unsyncedCount
    };
  }
}

// Export singleton instance
export const localStore = new LocalStore();