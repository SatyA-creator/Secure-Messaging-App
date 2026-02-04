// src/lib/relayClient.ts
/**
 * Relay Client - Frontend interface for relay-based messaging
 * Handles acknowledgments, pending message fetching, and relay protocol
 */

import { ENV } from '../config/env';
import { LocalMessage, localStore } from './localStore';

export interface RelayMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  encrypted_content: string;
  encrypted_session_key: string;
  crypto_version: string;
  encryption_algorithm: string;
  kdf_algorithm: string;
  signatures?: any[];
  has_media: boolean;
  media_refs?: any[];
  created_at: string;
  delivery_attempts: number;
}

export class RelayClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${ENV.API_URL}/relay`;
  }

  /**
   * Send message via relay service (no server storage)
   */
  async sendMessage(
    recipientId: string,
    encryptedContent: string,
    encryptedSessionKey: string,
    cryptoMetadata?: {
      cryptoVersion?: string;
      encryptionAlgorithm?: string;
      kdfAlgorithm?: string;
      signatures?: any[];
    },
    mediaInfo?: {
      hasMedia: boolean;
      mediaAttachments?: any[];
    }
  ): Promise<{ success: boolean; message_id: string; status: string; expires_at: string }> {
    const token = localStorage.getItem('authToken');
    
    console.log('🔄 Relay API call:', {
      url: `${this.baseUrl}/send`,
      recipientId,
      hasToken: !!token,
      hasMedia: mediaInfo?.hasMedia || false
    });
    
    const response = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipient_id: recipientId,
        encrypted_content: encryptedContent,
        encrypted_session_key: encryptedSessionKey,
        crypto_version: cryptoMetadata?.cryptoVersion || 'v1',
        encryption_algorithm: cryptoMetadata?.encryptionAlgorithm || 'ECDH-AES256-GCM',
        kdf_algorithm: cryptoMetadata?.kdfAlgorithm || 'HKDF-SHA256',
        signatures: cryptoMetadata?.signatures,
        has_media: mediaInfo?.hasMedia || false,
        media_refs: mediaInfo?.mediaAttachments || []
      })
    });

    console.log('📡 Relay API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Relay API error:', errorText);
      throw new Error(`Relay send failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Relay API success:', result);
    return result;
  }

  /**
   * Acknowledge message delivery - server deletes the message
   */
  async acknowledgeMessage(messageId: string): Promise<boolean> {
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${this.baseUrl}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message_id: messageId
        })
      });

      if (!response.ok) {
        console.warn(`ACK failed for ${messageId}: ${response.statusText}`);
        return false;
      }

      const result = await response.json();
      console.log(`✅ Acknowledged message ${messageId}:`, result.status);
      return true;
    } catch (error) {
      console.error(`❌ ACK error for ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Fetch pending relay messages on reconnect
   */
  async fetchPendingMessages(): Promise<RelayMessage[]> {
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${this.baseUrl}/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pending messages: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📬 Fetched ${result.count} pending relay messages`);
      return result.messages || [];
    } catch (error) {
      console.error('❌ Failed to fetch pending messages:', error);
      return [];
    }
  }

  /**
   * Process relay message: save to IndexedDB and acknowledge
   */
  async processRelayMessage(
    relayMsg: RelayMessage,
    currentUserId: string
  ): Promise<void> {
    try {
      console.log(`📦 Processing relay message ${relayMsg.id}:`, {
        sender: relayMsg.sender_id,
        recipient: relayMsg.recipient_id,
        currentUser: currentUserId
      });
      
      // Determine conversation ID (the other person in the conversation)
      const conversationId = relayMsg.sender_id === currentUserId
        ? relayMsg.recipient_id
        : relayMsg.sender_id;

      console.log(`💾 Saving to conversationId: ${conversationId}`);
      
      // Strip 'encrypted:' prefix from content for storage
      const contentToSave = relayMsg.encrypted_content.startsWith('encrypted:')
        ? relayMsg.encrypted_content.substring(10)
        : relayMsg.encrypted_content;

      // Save to IndexedDB
      const localMessage: Omit<LocalMessage, 'createdAt'> = {
        id: relayMsg.id,
        conversationId,
        from: relayMsg.sender_id,
        to: relayMsg.recipient_id,
        timestamp: relayMsg.created_at,
        content: contentToSave, // Decrypted/clean content
        signature: undefined, // Legacy field
        synced: true, // Received from relay
        // Crypto metadata
        cryptoVersion: relayMsg.crypto_version,
        encryptionAlgorithm: relayMsg.encryption_algorithm,
        kdfAlgorithm: relayMsg.kdf_algorithm,
        signatures: relayMsg.signatures,
        // Media attachments
        hasMedia: relayMsg.has_media || false,
        mediaAttachments: relayMsg.media_refs || [],
        mediaUrls: relayMsg.media_refs?.map((m: any) => m.file_url) || []
      };

      await localStore.saveMessage(localMessage);
      console.log(`✅ Successfully saved relay message ${relayMsg.id} to IndexedDB (conversation: ${conversationId})`);

      // Acknowledge to server (server will delete it)
      const ackSuccess = await this.acknowledgeMessage(relayMsg.id);
      if (ackSuccess) {
        console.log(`✅ Acknowledged message ${relayMsg.id} - server will delete it`);
      }
    } catch (error) {
      console.error(`❌ Failed to process relay message ${relayMsg.id}:`, error);
      console.error('   Error details:', error instanceof Error ? error.message : String(error));
      // Don't ACK if we couldn't save - message will be redelivered
    }
  }

  /**
   * Get relay service statistics
   */
  async getStats(): Promise<any> {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${this.baseUrl}/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get relay stats: ${response.statusText}`);
    }

    const result = await response.json();
    return result.stats;
  }
}

// Singleton instance
export const relayClient = new RelayClient();
