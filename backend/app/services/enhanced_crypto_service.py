# app/services/enhanced_crypto_service.py
from cryptography.hazmat.primitives.asymmetric import dh, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os
import hmac
import hashlib

class EnhancedCryptoService:
    
    @staticmethod
    def generate_ephemeral_key_pair():
        """Generate ephemeral ECDH key pair for each message"""
        from cryptography.hazmat.primitives.asymmetric import ec
        
        # Use SECP256R1 (P-256) - widely supported and secure
        private_key = ec.generate_private_key(
            ec.SECP256R1(),
            default_backend()
        )
        
        return private_key
    
    @staticmethod
    def perform_ecdh(private_key, peer_public_key):
        """Perform Elliptic Curve Diffie-Hellman"""
        from cryptography.hazmat.primitives.asymmetric import ec
        
        shared_key = private_key.exchange(
            ec.ECDH(),
            peer_public_key
        )
        
        return shared_key
    
    @staticmethod
    def derive_session_key(shared_secret: bytes, salt: bytes = None) -> bytes:
        """Derive session key using HKDF"""
        if salt is None:
            salt = b'\x00' * 32
        
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,  # 256-bit key
            salt=salt,
            info=b'message_encryption',
            backend=default_backend()
        )
        
        return hkdf.derive(shared_secret)
    
    @staticmethod
    def encrypt_message_pfs(plaintext: str, peer_public_key) -> dict:
        """
        Encrypt message with Perfect Forward Secrecy
        
        Process:
        1. Generate ephemeral key pair
        2. Perform ECDH with peer's public key
        3. Derive session key from shared secret
        4. Encrypt message with AES-256-GCM
        5. Return ephemeral public key + encrypted message
        """
        # Step 1: Generate ephemeral key pair
        ephemeral_private_key = EnhancedCryptoService.generate_ephemeral_key_pair()
        ephemeral_public_key = ephemeral_private_key.public_key()
        
        # Step 2: Perform ECDH
        shared_secret = EnhancedCryptoService.perform_ecdh(
            ephemeral_private_key,
            peer_public_key
        )
        
        # Step 3: Derive session key
        nonce = os.urandom(16)
        session_key = EnhancedCryptoService.derive_session_key(shared_secret, nonce)
        
        # Step 4: Encrypt message
        cipher = Cipher(
            algorithms.AES(session_key),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()
        
        # Step 5: Return data
        return {
            "ephemeral_public_key": ephemeral_public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ),
            "nonce": nonce,
            "tag": encryptor.tag,
            "ciphertext": ciphertext
        }
    
    @staticmethod
    def decrypt_message_pfs(encrypted_data: dict, recipient_private_key) -> str:
        """Decrypt message with PFS"""
        from cryptography.hazmat.primitives.asymmetric import ec
        
        # Load ephemeral public key
        ephemeral_public_key = serialization.load_pem_public_key(
            encrypted_data["ephemeral_public_key"],
            backend=default_backend()
        )
        
        # Perform ECDH with recipient's private key
        shared_secret = recipient_private_key.exchange(
            ec.ECDH(),
            ephemeral_public_key
        )
        
        # Derive session key
        session_key = EnhancedCryptoService.derive_session_key(
            shared_secret,
            encrypted_data["nonce"]
        )
        
        # Decrypt
        cipher = Cipher(
            algorithms.AES(session_key),
            modes.GCM(encrypted_data["nonce"], encrypted_data["tag"]),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        plaintext = decryptor.update(encrypted_data["ciphertext"]) + decryptor.finalize()
        
        return plaintext.decode()
