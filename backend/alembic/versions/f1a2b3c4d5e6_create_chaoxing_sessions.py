"""create chaoxing_sessions table

Revision ID: f1a2b3c4d5e6
Revises: e7c3d9f4a815
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e7c3d9f4a815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chaoxing_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("encrypted_cookies", sa.Text(), nullable=False),
        sa.Column("cx_uid", sa.String(50), nullable=False),
        sa.Column("cx_name", sa.String(100), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_chaoxing_sessions_user_id", "chaoxing_sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_chaoxing_sessions_user_id", table_name="chaoxing_sessions")
    op.drop_table("chaoxing_sessions")
