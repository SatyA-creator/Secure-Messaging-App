/**
 * Frontend Cryptography Service
 * Provides end-to-end encryption using Web Crypto API
 * 
 * Algorithm: ECDH (P-256) + AES-256-GCM
 * Perfect Forward Secrecy: Ephemeral keys per message
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// IndexedDB Schema for key storage
interface CryptoKeyDB extends DBSchema {
  keys: {
    key: string; // 'user_id'
    value: {
      userId: string;
      privateKey: JsonWebKey;
      publicKey: JsonWebKey;
      createdAt: string;
      algorithm: string;
    };
  };
}

export class CryptoService {
  private static db: IDBPDatabase<CryptoKeyDB> | null = null;

  /**
   * Initialize the crypto service and IndexedDB
   */
  static async init(): Promise<void> {
    if (!this.db) {
      this.db = await openDB<CryptoKeyDB>('quantchat-crypto', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: 'userId' });
          }
        },
      });
    }
  }

  /**
   * Generate ECDH keypair for user (P-256 curve)
   * Called during registration
   */
  static async generateUserKeypair(): Promise<{
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
  }> {
    const keypair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256', // NIST P-256 (secp256r1)
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keypair.privateKey);

    return {
      publicKey: publicKeyJwk,
      privateKey: privateKeyJwk,
    };
  }

  /**
   * Store user's keypair in IndexedDB
   */
  static async storeKeypair(
    userId: string,
    privateKey: JsonWebKey,
    publicKey: JsonWebKey
  ): Promise<void> {
    await this.init();
    await this.db!.put('keys', {
      userId,
      privateKey,
      publicKey,
      createdAt: new Date().toISOString(),
      algorithm: 'ECDH-P256',
    });
  }

  /**
   * Load user's private key from IndexedDB
   */
  static async loadPrivateKey(userId: string): Promise<CryptoKey | null> {
    await this.init();
    const keyData = await this.db!.get('keys', userId);
    if (!keyData) return null;

    return await window.crypto.subtle.importKey(
      'jwk',
      keyData.privateKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Load user's public key from IndexedDB
   */
  static async loadPublicKey(userId: string): Promise<JsonWebKey | null> {
    await this.init();
    const keyData = await this.db!.get('keys', userId);
    return keyData?.publicKey || null;
  }

  /**
   * Import recipient's public key (from server)
   */
  static async importPublicKey(publicKeyJwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );
  }

  /**
   * Encrypt a message with Perfect Forward Secrecy
   * 
   * Process:
   * 1. Generate ephemeral ECDH keypair
   * 2. Perform ECDH with recipient's public key
   * 3. Derive AES-256 key using HKDF
   * 4. Encrypt message with AES-256-GCM
   * 5. Return encrypted package
   */
  static async encryptMessage(
    plaintext: string,
    recipientPublicKeyJwk: JsonWebKey
  ): Promise<{
    ciphertext: string; // base64
    ephemeralPublicKey: JsonWebKey;
    nonce: string; // base64
    tag: string; // base64 (from GCM)
    algorithm: string;
    cryptoVersion: string;
  }> {
    // Step 1: Generate ephemeral keypair (one-time use)
    const ephemeralKeypair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey']
    );

    // Step 2: Import recipient's public key
    const recipientPublicKey = await this.importPublicKey(recipientPublicKeyJwk);

    // Step 3: Perform ECDH to get shared secret
    const sharedSecret = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey,
      },
      ephemeralKeypair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt']
    );

    // Step 4: Generate random nonce (96 bits for GCM)
    const nonce = window.crypto.getRandomValues(new Uint8Array(12));

    // Step 5: Encrypt message with AES-256-GCM
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        tagLength: 128, // 128-bit authentication tag
      },
      sharedSecret,
      plaintextBytes
    );

    // GCM returns ciphertext + tag concatenated
    const ciphertextBytes = new Uint8Array(ciphertextBuffer);
    const ciphertextOnly = ciphertextBytes.slice(0, -16); // Last 16 bytes are tag
    const tag = ciphertextBytes.slice(-16);

    // Step 6: Export ephemeral public key
    const ephemeralPublicKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      ephemeralKeypair.publicKey
    );

    // Step 7: Return encrypted package
    return {
      ciphertext: this.arrayBufferToBase64(ciphertextOnly),
      ephemeralPublicKey: ephemeralPublicKeyJwk,
      nonce: this.arrayBufferToBase64(nonce),
      tag: this.arrayBufferToBase64(tag),
      algorithm: 'ECDH-AES256-GCM',
      cryptoVersion: 'v1',
    };
  }

  /**
   * Decrypt a message
   * 
   * Process:
   * 1. Load recipient's private key
   * 2. Import ephemeral public key
   * 3. Perform ECDH to derive shared secret
   * 4. Derive same AES-256 key
   * 5. Decrypt ciphertext
   */
  static async decryptMessage(
    encryptedPackage: {
      ciphertext: string;
      ephemeralPublicKey: JsonWebKey;
      nonce: string;
      tag: string;
    },
    recipientPrivateKey: CryptoKey
  ): Promise<string> {
    // Step 1: Import ephemeral public key
    const ephemeralPublicKey = await this.importPublicKey(
      encryptedPackage.ephemeralPublicKey
    );

    // Step 2: Perform ECDH to get shared secret
    const sharedSecret = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: ephemeralPublicKey,
      },
      recipientPrivateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // Step 3: Decode base64 values
    const ciphertext = this.base64ToArrayBuffer(encryptedPackage.ciphertext);
    const nonce = this.base64ToArrayBuffer(encryptedPackage.nonce);
    const tag = this.base64ToArrayBuffer(encryptedPackage.tag);

    // Step 4: Reconstruct ciphertext + tag
    const ciphertextWithTag = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    ciphertextWithTag.set(new Uint8Array(ciphertext), 0);
    ciphertextWithTag.set(new Uint8Array(tag), ciphertext.byteLength);

    // Step 5: Decrypt with AES-256-GCM
    try {
      const plaintextBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128,
        },
        sharedSecret,
        ciphertextWithTag
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBuffer);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt message - invalid key or corrupted data');
    }
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Delete user's keys (logout)
   */
  static async deleteKeys(userId: string): Promise<void> {
    await this.init();
    await this.db!.delete('keys', userId);
  }
}
