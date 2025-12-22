"""Add role column to users table

Revision ID: add_user_role
Revises: f55f043c7909
Create Date: 2025-12-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_user_role'
down_revision = 'f55f043c7909'
branch_labels = None
depends_on = None


def upgrade():
    # Add role column with default value 'user'
    op.add_column('users', sa.Column('role', sa.String(length=20), nullable=False, server_default='user'))
    
    # Update existing users to be admins if they're the first user, otherwise users
    # This is a simple approach - you might want to manually set admin roles
    op.execute("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)")


def downgrade():
    op.drop_column('users', 'role')
