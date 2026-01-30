"""Add crypto agility fields for PQ readiness

Revision ID: b56533ee5f8d
Revises: 438b2179bf8b
Create Date: 2026-01-30 12:57:45.421392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b56533ee5f8d'
down_revision: Union[str, None] = '438b2179bf8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add crypto versioning fields to messages table
    op.add_column('messages', sa.Column('crypto_version', sa.Text(), nullable=False, server_default='v1'))
    op.add_column('messages', sa.Column('encryption_algorithm', sa.Text(), nullable=False, server_default='ECDH-AES256-GCM'))
    op.add_column('messages', sa.Column('kdf_algorithm', sa.Text(), nullable=False, server_default='HKDF-SHA256'))
    
    # Add multi-signature support (JSON array)
    op.add_column('messages', sa.Column('signatures', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Change public_key to public_keys in users table (multi-key storage)
    # First, create new column
    op.add_column('users', sa.Column('public_keys', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Migrate existing public_key data to public_keys format
    # Structure: [{"key_id": "default", "algorithm": "SECP256R1", "key_data": base64, "created_at": timestamp, "status": "active"}]
    op.execute("""
        UPDATE users 
        SET public_keys = jsonb_build_array(
            jsonb_build_object(
                'key_id', 'legacy-key-' || id::text,
                'algorithm', 'SECP256R1',
                'key_data', encode(public_key, 'base64'),
                'created_at', COALESCE(created_at::text, NOW()::text),
                'status', 'active'
            )
        )
        WHERE public_key IS NOT NULL
    """)
    
    # Make public_keys NOT NULL now that data is migrated
    op.alter_column('users', 'public_keys', nullable=False)
    
    # Drop old public_key column
    op.drop_column('users', 'public_key')


def downgrade() -> None:
    # Reverse migration: restore public_key from public_keys
    op.add_column('users', sa.Column('public_key', sa.LargeBinary(), nullable=True))
    
    # Extract first key from public_keys array
    op.execute("""
        UPDATE users
        SET public_key = decode(public_keys->0->>'key_data', 'base64')
        WHERE public_keys IS NOT NULL
    """)
    
    op.alter_column('users', 'public_key', nullable=False)
    op.drop_column('users', 'public_keys')
    
    # Remove crypto metadata from messages
    op.drop_column('messages', 'signatures')
    op.drop_column('messages', 'kdf_algorithm')
    op.drop_column('messages', 'encryption_algorithm')
    op.drop_column('messages', 'crypto_version')

