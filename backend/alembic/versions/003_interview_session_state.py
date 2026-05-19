"""Add interview session_state JSON column

Revision ID: 003_interview_session_state
Revises: 002_add_phone_avatar_text
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "003_interview_session_state"
down_revision = "002_add_phone_avatar_text"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("interviews", sa.Column("session_state", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("interviews", "session_state")
