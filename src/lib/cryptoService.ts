// src/lib/cryptoService.ts
/**
 * Client-side encryption service using Web Crypto API
 * Implements ECDH (P-256) + HKDF-SHA256 + AES-256-GCM
 * Matches backend's enhanced_crypto_service.py algorithm suite
 */

import Dexie, { Table } from 'dexie';

// Constants matching backend's algorithm registry
const ECDH_CURVE = 'P-256'; // SECP256R1
const AES_KEY_LENGTH = 256;
const AES_IV_LENGTH = 12; // 96 bits for GCM
const HKDF_SALT_LENGTH = 16;
const HKDF_INFO = new TextEncoder().encode('message_encryption');

// Encrypted message envelope format
export interface EncryptedEnvelope {
  v: string;           // crypto version
  alg: string;         // algorithm suite
  epk: JsonWebKey;     // ephemeral public key (JWK)
  iv: string;          // base64 IV/nonce
  salt: string;        // base64 HKDF salt
  ct: string;          // base64 ciphertext (includes GCM auth tag)
}

// Stored key pair in IndexedDB
interface StoredKeyPair {
  id: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: string;
}

// Separate Dexie database for key storage (avoids migration issues with message DB)
class CryptoKeyDB extends Dexie {
  keyPairs!: Table<StoredKeyPair>;

  constructor() {
    super('QuChatCryptoKeys');
    this.version(1).stores({
      keyPairs: 'id'
    });
  }
}

const keyDb = new CryptoKeyDB();

// --- Utility functions ---

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- CryptoService ---

class CryptoService {
  private keyPairCache: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;
  // ✅ Track whether the key was just generated (vs loaded from IndexedDB)
  // Only upload to server when newly generated — prevents overwriting another device's key on refresh
  private _keyIsNew = false;

  /**
   * Generate a new ECDH key pair (P-256)
   */
  async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: ECDH_CURVE },
      true, // extractable for JWK storage
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Export a public key as base64-encoded JWK string (for backend storage/transmission)
   */
  async exportPublicKey(key: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey('jwk', key);
    return btoa(JSON.stringify(jwk));
  }

  /**
   * Import a public key from base64-encoded JWK string
   */
  async importPublicKey(base64Jwk: string): Promise<CryptoKey> {
    const jwk: JsonWebKey = JSON.parse(atob(base64Jwk));
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: ECDH_CURVE },
      true,
      []
    );
  }

  /**
   * Save key pair to IndexedDB for persistence across sessions
   */
  async saveKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    await keyDb.keyPairs.put({
      id: 'current',
      publicKeyJwk,
      privateKeyJwk,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Load key pair from IndexedDB
   */
  async loadKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
    const stored = await keyDb.keyPairs.get('current');
    if (!stored) return null;

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      stored.publicKeyJwk,
      { name: 'ECDH', namedCurve: ECDH_CURVE },
      true,
      []
    );

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      stored.privateKeyJwk,
      { name: 'ECDH', namedCurve: ECDH_CURVE },
      true,
      ['deriveKey', 'deriveBits']
    );

    return { publicKey, privateKey };
  }

  /**
   * Get or create the user's ECDH key pair (cached + IndexedDB backed).
   * Tracks whether the key was newly generated via isKeyNewlyGenerated().
   */
  async getOrCreateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
    if (this.keyPairCache) {
      // Already loaded this session — not new
      this._keyIsNew = false;
      return this.keyPairCache;
    }

    // Try loading from IndexedDB
    const stored = await this.loadKeyPair();
    if (stored) {
      this.keyPairCache = stored;
      this._keyIsNew = false;  // Existing key, don't overwrite server
      return stored;
    }

    // Generate new key pair — this device has no key yet
    const keyPair = await this.generateKeyPair();
    await this.saveKeyPair(keyPair);
    this.keyPairCache = { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
    this._keyIsNew = true;  // Newly generated — should upload to server
    return this.keyPairCache;
  }

  /**
   * Returns true only if the key was just generated in this session
   * (first login on this device/browser). Used to avoid unnecessary server uploads.
   */
  isKeyNewlyGenerated(): boolean {
    return this._keyIsNew;
  }

  /**
   * Get the user's public key as base64-encoded JWK (for uploading to backend)
   */
  async getPublicKeyBase64(): Promise<string> {
    const { publicKey } = await this.getOrCreateKeyPair();
    return this.exportPublicKey(publicKey);
  }

  /**
   * Clear cached key pair (call on logout)
   */
  clearCache(): void {
    this.keyPairCache = null;
  }

  /**
   * Export the private key as a password-encrypted backup blob (for server storage).
   * The private key JWK is encrypted with AES-256-GCM using a PBKDF2-derived key.
   * The server stores the ciphertext and can never read the private key.
   */
  async exportPrivateKeyBackup(password: string): Promise<string> {
    const { privateKey } = await this.getOrCreateKeyPair();
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);
    const encoder = new TextEncoder();

    // Derive AES-256-GCM key from password via PBKDF2
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordKey = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Encrypt the private key JWK
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(JSON.stringify(privateKeyJwk))
    );

    const backup = {
      alg: 'PBKDF2-AES-256-GCM',
      iterations: 100000,
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      ct: arrayBufferToBase64(new Uint8Array(encrypted)),
    };
    return btoa(JSON.stringify(backup));
  }

  /**
   * Restore the private key from a password-encrypted backup blob.
   * Returns true if successful, false if the password is wrong or backup is corrupt.
   * On success, the restored key is saved to IndexedDB and set as the active key.
   */
  async importPrivateKeyBackup(encryptedBackup: string, password: string): Promise<boolean> {
    try {
      const backup = JSON.parse(atob(encryptedBackup));
      const encoder = new TextEncoder();

      // Derive the same AES key from the password + stored salt
      const passwordKey = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: base64ToArrayBuffer(backup.salt),
          iterations: backup.iterations || 100000,
          hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt the private key JWK
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(backup.iv) },
        aesKey,
        base64ToArrayBuffer(backup.ct)
      );

      const privateKeyJwk: JsonWebKey = JSON.parse(new TextDecoder().decode(decrypted));

      // Import private key
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Derive public key from the same JWK (x and y are always present in ECDH JWKs)
      const publicKeyJwk: JsonWebKey = {
        kty: privateKeyJwk.kty,
        crv: privateKeyJwk.crv,
        x: privateKeyJwk.x,
        y: privateKeyJwk.y,
        key_ops: [],
        ext: true,
      };
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        []
      );

      // Persist to IndexedDB and activate
      await keyDb.keyPairs.put({
        id: 'current',
        publicKeyJwk,
        privateKeyJwk,
        createdAt: new Date().toISOString(),
      });
      this.keyPairCache = { publicKey, privateKey };
      this._keyIsNew = false;

      console.log('✅ Private key restored from encrypted backup');
      return true;
    } catch (err) {
      console.warn('⚠️ Could not restore key backup (wrong password or corrupt data):', err);
      return false;
    }
  }

  /**
   * Check if a string looks like an encrypted envelope (vs legacy plaintext)
   */
  isEncryptedEnvelope(content: string): boolean {
    try {
      const decoded = atob(content);
      const parsed = JSON.parse(decoded);
      return parsed.v && parsed.alg && parsed.epk && parsed.ct;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt a message for a recipient using ECDH + AES-256-GCM with PFS
   *
   * Flow:
   * 1. Generate ephemeral ECDH key pair (PFS)
   * 2. Derive shared secret: ECDH(ephemeral_private, recipient_public)
   * 3. Derive AES key: HKDF-SHA256(shared_secret, random_salt)
   * 4. Encrypt: AES-256-GCM(aes_key, plaintext)
   * 5. Package as base64 envelope
   */
  async encryptMessage(plaintext: string, recipientPublicKeyBase64: string): Promise<string> {
    // 1. Generate ephemeral key pair for PFS
    const ephemeralKeyPair = await this.generateKeyPair();

    // 2. Import recipient's public key
    const recipientPublicKey = await this.importPublicKey(recipientPublicKeyBase64);

    // 3. Derive shared secret via ECDH
    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      256
    );

    // 4. Derive AES key via HKDF-SHA256
    const salt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
    const hkdfBaseKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
      hkdfBaseKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      false,
      ['encrypt']
    );

    // 5. Encrypt with AES-256-GCM
    const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(plaintext)
    );

    // 6. Export ephemeral public key as JWK
    const epkJwk = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

    // 7. Package as encrypted envelope
    const envelope: EncryptedEnvelope = {
      v: '1',
      alg: 'ECDH-AES256-GCM',
      epk: epkJwk,
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      ct: arrayBufferToBase64(new Uint8Array(ciphertext)),
    };

    return btoa(JSON.stringify(envelope));
  }

  /**
   * Decrypt a message using our private key + sender's ephemeral public key
   *
   * Flow:
   * 1. Parse the encrypted envelope
   * 2. Import sender's ephemeral public key
   * 3. Derive shared secret: ECDH(our_private, ephemeral_public)
   * 4. Derive AES key: HKDF-SHA256(shared_secret, salt)
   * 5. Decrypt: AES-256-GCM(aes_key, ciphertext)
   */
  async decryptMessage(encryptedContent: string): Promise<string> {
    try {
      // 1. Parse envelope
      const envelope: EncryptedEnvelope = JSON.parse(atob(encryptedContent));

      if (envelope.v !== '1' || envelope.alg !== 'ECDH-AES256-GCM') {
        throw new Error(`Unsupported crypto version/algorithm: ${envelope.v}/${envelope.alg}`);
      }

      // 2. Import sender's ephemeral public key
      const ephemeralPublicKey = await crypto.subtle.importKey(
        'jwk',
        envelope.epk,
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        []
      );

      // 3. Get our private key
      const { privateKey } = await this.getOrCreateKeyPair();

      // 4. Derive shared secret via ECDH
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPublicKey },
        privateKey,
        256
      );

      // 5. Derive AES key via HKDF-SHA256
      const salt = base64ToArrayBuffer(envelope.salt);
      const hkdfBaseKey = await crypto.subtle.importKey(
        'raw',
        sharedBits,
        'HKDF',
        false,
        ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
        hkdfBaseKey,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['decrypt']
      );

      // 6. Decrypt with AES-256-GCM
      const iv = base64ToArrayBuffer(envelope.iv);
      const ct = base64ToArrayBuffer(envelope.ct);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ct
      );

      return new TextDecoder().decode(plaintext);
    } catch (error: any) {
      console.error('❌ Decryption failed:', {
        error: error.message,
        errorName: error.name,
        errorStack: error.stack
      });
      
      // Check if it's a key mismatch issue
      if (error.name === 'OperationError' || error.message?.includes('operation failed')) {
        console.error('🔑 Key mismatch detected: Message was encrypted with a different public key than your current private key');
        console.error('💡 This can happen if you logged in from a different device or browser');
      }
      
      throw error;
    }
  }
}

// Singleton instance
export const cryptoService = new CryptoService();
