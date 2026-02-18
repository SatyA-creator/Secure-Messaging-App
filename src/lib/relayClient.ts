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
    },
    // ✅ Self-encrypted copy so sender can read their messages on any device
    senderEncryptedContent?: string
  ): Promise<{ success: boolean; message_id: string; status: string; expires_at: string }> {
    const token = localStorage.getItem('authToken');

    // SECURITY: Only log metadata, never message content
    console.log('Relay: sending encrypted message to', recipientId);

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
        media_refs: mediaInfo?.mediaAttachments || [],
        sender_encrypted_content: senderEncryptedContent || null
      })
    });

    console.log('Relay API response:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Relay API error:', response.status);
      throw new Error(`Relay send failed: ${response.statusText}`);
    }

    const result = await response.json();
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
      // Determine conversation ID (the other person in the conversation)
      const conversationId = relayMsg.sender_id === currentUserId
        ? relayMsg.recipient_id
        : relayMsg.sender_id;

      // Decrypt the content before storing locally
      // The actual decryption is handled by ChatContext's handleNewMessage,
      // so here we just pass through the encrypted content for the handler to decrypt.
      // The relay client stores the raw encrypted content; ChatContext decrypts it.
      const contentToSave = relayMsg.encrypted_content;

      // Save to IndexedDB (content will be decrypted by ChatContext before display)
      const localMessage: Omit<LocalMessage, 'createdAt'> = {
        id: relayMsg.id,
        conversationId,
        from: relayMsg.sender_id,
        to: relayMsg.recipient_id,
        timestamp: relayMsg.created_at,
        content: contentToSave,
        signature: undefined,
        synced: true,
        cryptoVersion: relayMsg.crypto_version,
        encryptionAlgorithm: relayMsg.encryption_algorithm,
        kdfAlgorithm: relayMsg.kdf_algorithm,
        signatures: relayMsg.signatures,
        hasMedia: relayMsg.has_media || false,
        mediaAttachments: relayMsg.media_refs || [],
        mediaUrls: relayMsg.media_refs?.map((m: any) => m.file_url) || []
      };

      await localStore.saveMessage(localMessage);

      // Acknowledge to server (server will delete it)
      await this.acknowledgeMessage(relayMsg.id);
    } catch (error) {
      console.error(`Failed to process relay message ${relayMsg.id}:`, error);
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
