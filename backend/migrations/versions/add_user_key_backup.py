"""Add encrypted_private_key column to users for cross-device key sync

Revision ID: add_user_key_backup
Revises: add_sender_encrypted_content
Create Date: 2026-02-18

Stores the user's ECDH private key encrypted with a PBKDF2-derived AES-256-GCM
key (derived from the user's password). This lets any device the user logs into
restore the same private key, so all messages are decryptable on all devices.
The server never sees the plaintext private key.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_user_key_backup'
down_revision = 'add_sender_encrypted_content'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='users' AND column_name='encrypted_private_key'
            ) THEN
                ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='users' AND column_name='encrypted_private_key'
            ) THEN
                ALTER TABLE users DROP COLUMN encrypted_private_key;
            END IF;
        END $$;
    """)
