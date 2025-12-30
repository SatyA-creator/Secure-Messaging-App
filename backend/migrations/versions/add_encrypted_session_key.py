"""add encrypted_session_key column

Revision ID: add_encrypted_session_key
Revises: 
Create Date: 2025-12-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_encrypted_session_key'
down_revision = None
depends_on = None


def upgrade():
    # Add encrypted_session_key column if it doesn't exist
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='encrypted_session_key'
            ) THEN
                ALTER TABLE messages ADD COLUMN encrypted_session_key BYTEA;
            END IF;
        END $$;
    """)
    
    # Drop 'content' column if it exists (it's not in the model)
    op.execute("""
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='content'
            ) THEN
                ALTER TABLE messages DROP COLUMN content;
            END IF;
        END $$;
    """)
    
    # Update existing rows to have a default encrypted_session_key if null
    op.execute("""
        UPDATE messages 
        SET encrypted_session_key = E'\\\\x64656661756c742d6b6579'::bytea 
        WHERE encrypted_session_key IS NULL;
    """)
    
    # Make encrypted_session_key NOT NULL after setting defaults
    op.execute("""
        ALTER TABLE messages ALTER COLUMN encrypted_session_key SET NOT NULL;
    """)
    
    # Add is_deleted column if it doesn't exist
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='is_deleted'
            ) THEN
                ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;
            END IF;
        END $$;
    """)


def downgrade():
    # Revert changes
    op.execute("""
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='encrypted_session_key'
            ) THEN
                ALTER TABLE messages DROP COLUMN encrypted_session_key;
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='content'
            ) THEN
                ALTER TABLE messages ADD COLUMN content TEXT;
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='is_deleted'
            ) THEN
                ALTER TABLE messages DROP COLUMN is_deleted;
            END IF;
        END $$;
    """)
