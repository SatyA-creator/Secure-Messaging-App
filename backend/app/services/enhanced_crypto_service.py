# app/services/enhanced_crypto_service.py
from cryptography.hazmat.primitives.asymmetric import dh, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os
import hmac
import hashlib
from typing import Dict, Callable, Any

class EnhancedCryptoService:
    
    # Algorithm Registry for cryptographic agility
    ALGORITHM_REGISTRY: Dict[str, Dict[str, Any]] = {
        "ECDH-AES256-GCM": {
            "key_exchange": "ECDH",
            "encryption": "AES-256-GCM",
            "kdf": "HKDF-SHA256",
            "version": "v1"
        }
        # Future PQ algorithms will be added here:
        # "ML-KEM-768-AES256-GCM": {...}
        # "Kyber1024-ChaCha20": {...}
    }
    
    # KDF Algorithm Registry
    KDF_REGISTRY: Dict[str, Dict[str, Any]] = {
        "HKDF-SHA256": {
            "hash_algorithm": hashes.SHA256,
            "key_length": 32
        }
        # Future: "HKDF-SHA3-256", etc.
    }
    
    @staticmethod
    def get_active_algorithms() -> Dict[str, str]:
        """Returns the currently active cryptographic algorithm suite"""
        return {
            "crypto_version": "v1",
            "encryption_algorithm": "ECDH-AES256-GCM",
            "kdf_algorithm": "HKDF-SHA256"
        }
    
    @staticmethod
    def select_encryption_algorithm(peer_algorithms: list = None) -> str:
        """
        Select appropriate encryption algorithm based on peer capabilities.
        Future: Will negotiate between classical and PQ algorithms.
        """
        # For now, return default. Future: algorithm negotiation logic
        return "ECDH-AES256-GCM"
    
    @staticmethod
    def select_kdf_algorithm(encryption_algorithm: str = None) -> str:
        """Select appropriate KDF algorithm for the encryption algorithm"""
        # Future: Map different encryption algorithms to appropriate KDFs
        return "HKDF-SHA256"
    
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
    def derive_session_key(shared_secret: bytes, salt: bytes = None, kdf_algorithm: str = "HKDF-SHA256") -> bytes:
        """
        Derive session key using specified KDF algorithm.
        Supports algorithm agility for future PQ-safe KDFs.
        """
        if salt is None:
            salt = b'\x00' * 32
        
        # Get KDF configuration from registry
        kdf_config = EnhancedCryptoService.KDF_REGISTRY.get(kdf_algorithm)
        if not kdf_config:
            raise ValueError(f"Unsupported KDF algorithm: {kdf_algorithm}")
        
        hkdf = HKDF(
            algorithm=kdf_config["hash_algorithm"](),
            length=kdf_config["key_length"],
            salt=salt,
            info=b'message_encryption',
            backend=default_backend()
        )
        
        return hkdf.derive(shared_secret)
    
    @staticmethod
    def encrypt_message_pfs(plaintext: str, peer_public_key, algorithm: str = "ECDH-AES256-GCM") -> dict:
        """
        Encrypt message with Perfect Forward Secrecy using specified algorithm.
        
        Process:
        1. Generate ephemeral key pair
        2. Perform ECDH with peer's public key
        3. Derive session key from shared secret
        4. Encrypt message with AES-256-GCM
        5. Return ephemeral public key + encrypted message + crypto metadata
        """
        # Get algorithm metadata
        active_algos = EnhancedCryptoService.get_active_algorithms()
        
        # Step 1: Generate ephemeral key pair
        ephemeral_private_key = EnhancedCryptoService.generate_ephemeral_key_pair()
        ephemeral_public_key = ephemeral_private_key.public_key()
        
        # Step 2: Perform ECDH
        shared_secret = EnhancedCryptoService.perform_ecdh(
            ephemeral_private_key,
            peer_public_key
        )
        
        # Step 3: Derive session key with algorithm metadata
        nonce = os.urandom(16)
        session_key = EnhancedCryptoService.derive_session_key(
            shared_secret, 
            nonce,
            kdf_algorithm=active_algos["kdf_algorithm"]
        )
        
        # Step 4: Encrypt message
        cipher = Cipher(
            algorithms.AES(session_key),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()
        
        # Step 5: Return data with crypto metadata
        return {
            "ephemeral_public_key": ephemeral_public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ),
            "nonce": nonce,
            "tag": encryptor.tag,
            "ciphertext": ciphertext,
            # Crypto metadata for algorithm agility
            "crypto_version": active_algos["crypto_version"],
            "encryption_algorithm": active_algos["encryption_algorithm"],
            "kdf_algorithm": active_algos["kdf_algorithm"]
        }
    
    @staticmethod
    def decrypt_message_pfs(encrypted_data: dict, recipient_private_key, kdf_algorithm: str = None) -> str:
        """
        Decrypt message with PFS using algorithm metadata.
        Supports decryption of messages encrypted with different algorithms.
        """
        from cryptography.hazmat.primitives.asymmetric import ec
        
        # Extract KDF algorithm from metadata or use default
        if kdf_algorithm is None:
            kdf_algorithm = encrypted_data.get("kdf_algorithm", "HKDF-SHA256")
        
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
        
        # Derive session key using the algorithm specified in metadata
        session_key = EnhancedCryptoService.derive_session_key(
            shared_secret,
            encrypted_data["nonce"],
            kdf_algorithm=kdf_algorithm
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
