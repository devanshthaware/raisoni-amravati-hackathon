import os
import json
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
from dotenv import load_dotenv

load_dotenv(".env.local")

# Load the master key from environment
MASTER_KEY_B64 = os.getenv("MASTER_ENCRYPTION_KEY")

def encrypt_metadata(data: dict) -> str:
    """
    Encrypts a dictionary into a secure AES-256 string.
    Returns: Base64 encoded string containing (IV + Ciphertext)
    """
    if not MASTER_KEY_B64:
        raise ValueError("MASTER_ENCRYPTION_KEY not set in environment.")
    
    key = base64.b64decode(MASTER_KEY_B64)
    if len(key) != 32:
        raise ValueError("MASTER_ENCRYPTION_KEY must be 32 bytes (256 bits) after base64 decode.")

    # Convert dict to JSON string
    json_data = json.dumps(data).encode("utf-8")

    # Generate random IV (16 bytes for AES)
    iv = os.urandom(16)

    # Padding (AES is a block cipher)
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(json_data) + padder.finalize()

    # Create Cipher object
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    encryptor = cipher.encryptor()

    # Encrypt
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    # Combine IV and Ciphertext for transport/storage
    combined = iv + ciphertext
    return base64.b64encode(combined).decode("utf-8")

def decrypt_metadata(encrypted_b64: str) -> dict:
    """
    Decrypts an AES-256 encrypted base64 string back into a dictionary.
    """
    if not MASTER_KEY_B64:
        raise ValueError("MASTER_ENCRYPTION_KEY not set in environment.")
    
    key = base64.b64decode(MASTER_KEY_B64)
    combined = base64.b64decode(encrypted_b64)
    
    iv = combined[:16]
    ciphertext = combined[16:]

    # Create Cipher object
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    decryptor = cipher.decryptor()

    # Decrypt
    padded_data = decryptor.update(ciphertext) + decryptor.finalize()

    # Unpadding
    unpadder = padding.PKCS7(128).unpadder()
    json_data = unpadder.update(padded_data) + unpadder.finalize()

    return json.loads(json_data.decode("utf-8"))
