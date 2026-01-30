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
    }
  ): Promise<{ success: boolean; message_id: string; status: string; expires_at: string }> {
    const token = localStorage.getItem('token');
    
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
        signatures: cryptoMetadata?.signatures
      })
    });

    if (!response.ok) {
      throw new Error(`Relay send failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Acknowledge message delivery - server deletes the message
   */
  async acknowledgeMessage(messageId: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    
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
    const token = localStorage.getItem('token');
    
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
      // Determine conversation ID
      const conversationId = relayMsg.sender_id === currentUserId
        ? relayMsg.recipient_id
        : relayMsg.sender_id;

      // Save to IndexedDB
      const localMessage: Omit<LocalMessage, 'createdAt'> = {
        id: relayMsg.id,
        conversationId,
        from: relayMsg.sender_id,
        to: relayMsg.recipient_id,
        timestamp: relayMsg.created_at,
        content: relayMsg.encrypted_content, // Will be decrypted by UI layer
        signature: undefined, // Legacy field
        synced: true, // Received from relay
        // Crypto metadata
        cryptoVersion: relayMsg.crypto_version,
        encryptionAlgorithm: relayMsg.encryption_algorithm,
        kdfAlgorithm: relayMsg.kdf_algorithm,
        signatures: relayMsg.signatures
      };

      await localStore.saveMessage(localMessage);
      console.log(`💾 Saved relay message ${relayMsg.id} to IndexedDB`);

      // Acknowledge to server (server will delete it)
      await this.acknowledgeMessage(relayMsg.id);
    } catch (error) {
      console.error(`❌ Failed to process relay message ${relayMsg.id}:`, error);
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
