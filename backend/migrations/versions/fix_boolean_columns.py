"""Fix boolean columns to use proper boolean type

Revision ID: fix_boolean_columns
Revises: 
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_boolean_columns'
down_revision = None  # Will be set automatically
branch_labels = None
depends_on = None


def upgrade():
    # Convert INTEGER columns to BOOLEAN
    op.execute("""
        ALTER TABLE messages 
        ALTER COLUMN is_read TYPE BOOLEAN USING (is_read::int::boolean),
        ALTER COLUMN is_deleted TYPE BOOLEAN USING (is_deleted::int::boolean),
        ALTER COLUMN has_media TYPE BOOLEAN USING (has_media::int::boolean)
    """)
    
    print("✅ Converted messages boolean columns")


def downgrade():
    # Revert back to INTEGER
    op.execute("""
        ALTER TABLE messages 
        ALTER COLUMN is_read TYPE INTEGER USING (is_read::boolean::int),
        ALTER COLUMN is_deleted TYPE INTEGER USING (is_deleted::boolean::int),
        ALTER COLUMN has_media TYPE INTEGER USING (has_media::boolean::int)
    """)
