"""Fix contacts table schema - ensure contact_id column exists

Revision ID: fix_contacts_schema
Revises: add_user_role
Create Date: 2025-12-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'fix_contacts_schema'
down_revision = 'add_user_role'
branch_labels = None
depends_on = None


def upgrade():
    # Check if contact_id column exists, if not add it
    # First, check if we need to migrate from old schema
    
    # Add contact_id column if it doesn't exist
    # This handles the case where the table might have a different structure
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'contacts' AND column_name = 'contact_id'
            ) THEN
                ALTER TABLE contacts ADD COLUMN contact_id UUID;
                ALTER TABLE contacts ADD CONSTRAINT fk_contacts_contact_id 
                    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    
    # Add nickname column if it doesn't exist
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'contacts' AND column_name = 'nickname'
            ) THEN
                ALTER TABLE contacts ADD COLUMN nickname VARCHAR(255);
            END IF;
        END $$;
    """)
    
    # Ensure unique constraint exists
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'unique_contact_pair'
            ) THEN
                ALTER TABLE contacts ADD CONSTRAINT unique_contact_pair 
                    UNIQUE (user_id, contact_id);
            END IF;
        END $$;
    """)


def downgrade():
    # This is a fix migration, we don't want to remove these columns
    pass
