"""add phone column and change avatar_url to text

Revision ID: 002_add_phone_avatar_text
Revises: 001_create_users_table
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = '002_add_phone_avatar_text'
down_revision = '001_create_users_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add phone column
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))

    # Change avatar_url from String(255) to Text for base64 storage
    op.alter_column(
        'users',
        'avatar_url',
        existing_type=sa.String(255),
        type_=sa.Text(),
        existing_nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        'users',
        'avatar_url',
        existing_type=sa.Text(),
        type_=sa.String(255),
        existing_nullable=True
    )
    op.drop_column('users', 'phone')
