"""Merge migration heads

Revision ID: 438b2179bf8b
Revises: add_encrypted_session_key, add_media_attachments, fix_boolean_columns, fix_contacts_schema
Create Date: 2026-01-30 12:57:34.997282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '438b2179bf8b'
down_revision: Union[str, None] = ('add_encrypted_session_key', 'add_media_attachments', 'fix_boolean_columns', 'fix_contacts_schema')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
