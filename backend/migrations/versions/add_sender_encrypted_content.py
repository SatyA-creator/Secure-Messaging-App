"""Add sender_encrypted_content for cross-device message history

Revision ID: add_sender_encrypted_content
Revises: b56533ee5f8d
Create Date: 2026-02-18

Adds a nullable sender_encrypted_content column to messages.
This stores a copy of the message encrypted with the SENDER's own public key,
allowing the sender to decrypt their own sent messages on any device that has
their private key — enabling cross-device message history sync.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_sender_encrypted_content'
down_revision = 'b56533ee5f8d'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='messages' AND column_name='sender_encrypted_content'
            ) THEN
                ALTER TABLE messages ADD COLUMN sender_encrypted_content TEXT;
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='messages' AND column_name='sender_encrypted_content'
            ) THEN
                ALTER TABLE messages DROP COLUMN sender_encrypted_content;
            END IF;
        END $$;
    """)
