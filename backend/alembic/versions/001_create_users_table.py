from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('user_id', sa.String(36), primary_key=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column(
            'role',
            sa.Enum(
                'CANDIDATE',
                'RECRUITER',
                'HIRING_MANAGER',
                'ADMINISTRATOR',
                name='userrole'
            ),
            nullable=False
        ),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('avatar_url', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS userrole")
