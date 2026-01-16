"""add media attachments table

Revision ID: add_media_attachments
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_media_attachments'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create media_attachments table
    op.create_table(
        'media_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
    )
    
    # Create index
    op.create_index('idx_media_message', 'media_attachments', ['message_id'])
    
    # Add has_media column to messages table
    op.add_column('messages', sa.Column('has_media', sa.Boolean(), default=False))


def downgrade():
    op.drop_column('messages', 'has_media')
    op.drop_index('idx_media_message', table_name='media_attachments')
    op.drop_table('media_attachments')
